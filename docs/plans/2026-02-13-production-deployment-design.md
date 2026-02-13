# Production Deployment Design

Date: 2026-02-13

## Context

Deploy Traumabomen to production on GCP. Two domains serve the same application, with the hostname determining the initial language: `traumabomen.nl` for Dutch, `traumatrees.org` for English. Deployments are triggered by pushing a git tag.

## Architecture

```
traumabomen.nl  ──┐
                   ├──> Cloud Run: traumabomen-frontend (nginx + SPA)
traumatrees.org ──┘         │
                            │  /api/*  (proxy_pass)
                            v
                   Cloud Run: traumabomen-api (FastAPI)
                            │
                            v
                   Cloud SQL: traumabomen-db (PostgreSQL 17, db-f1-micro)
```

- **Region**: europe-west4 (Netherlands)
- **Docker images**: Artifact Registry (`europe-west4-docker.pkg.dev/traumabomen/traumabomen`)
- **Secrets**: Secret Manager, injected as env vars at deploy time
- **CI/CD**: GitHub Actions, triggered on `v*` tags
- **Auth to GCP**: Workload Identity Federation (keyless)

Estimated cost at low traffic (< 100 daily users): ~$8-10/month (Cloud SQL is the main driver; Cloud Run is free tier).

## 1. GCP Project Setup

```bash
# Create project
gcloud projects create traumabomen --organization=YOUR_ORG_ID
gcloud config set project traumabomen
gcloud billing projects link traumabomen --billing-account=YOUR_BILLING_ACCOUNT

# Enable APIs
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com

# Artifact Registry
gcloud artifacts repositories create traumabomen \
  --repository-format=docker \
  --location=europe-west4 \
  --description="Traumabomen container images"
```

## 2. Cloud SQL

```bash
# Create instance
gcloud sql instances create traumabomen-db \
  --database-version=POSTGRES_17 \
  --tier=db-f1-micro \
  --region=europe-west4 \
  --backup-start-time=03:00 \
  --storage-auto-increase \
  --storage-size=10

# Create database and user
gcloud sql databases create traumabomen --instance=traumabomen-db

gcloud sql users create traumabomen \
  --instance=traumabomen-db \
  --password=GENERATE_A_STRONG_PASSWORD
```

The Cloud SQL instance connection name (needed for Cloud Run) is:
```
traumabomen:europe-west4:traumabomen-db
```

## 3. Secret Manager

Create these secrets:

```bash
# Database
echo -n "GENERATED_PASSWORD" | \
  gcloud secrets create db-password --data-file=-

echo -n "postgresql+asyncpg://traumabomen:GENERATED_PASSWORD@/traumabomen?host=/cloudsql/traumabomen:europe-west4:traumabomen-db" | \
  gcloud secrets create db-url --data-file=-

# Auth
openssl rand -hex 32 | tr -d '\n' | \
  gcloud secrets create jwt-secret --data-file=-

# SMTP (TransIP)
echo -n "smtp.transip.email" | \
  gcloud secrets create smtp-host --data-file=-

echo -n "587" | \
  gcloud secrets create smtp-port --data-file=-

echo -n "noreply@traumabomen.nl" | \
  gcloud secrets create smtp-user --data-file=-

echo -n "YOUR_SMTP_PASSWORD" | \
  gcloud secrets create smtp-password --data-file=-
```

## 4. Workload Identity Federation (GitHub Actions)

```bash
PROJECT_ID=traumabomen
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
GITHUB_ORG=YOUR_GITHUB_USERNAME  # or org name
GITHUB_REPO=traumabomen

# Create workload identity pool
gcloud iam workload-identity-pools create github-pool \
  --location=global \
  --display-name="GitHub Actions Pool"

# Create OIDC provider
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Create deploy service account
gcloud iam service-accounts create github-deploy \
  --display-name="GitHub Actions Deploy"

# Grant roles to the service account
for role in \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/cloudsql.client \
  roles/secretmanager.secretAccessor \
  roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:github-deploy@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="$role"
done

# Allow GitHub Actions to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding \
  "github-deploy@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${GITHUB_ORG}/${GITHUB_REPO}"
```

Store these as GitHub repository variables (not secrets -- they're not sensitive):

| Variable | Value |
|---|---|
| `GCP_PROJECT_ID` | `traumabomen` |
| `GCP_REGION` | `europe-west4` |
| `GCP_WIF_PROVIDER` | `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `GCP_SERVICE_ACCOUNT` | `github-deploy@traumabomen.iam.gserviceaccount.com` |
| `CLOUD_SQL_INSTANCE` | `traumabomen:europe-west4:traumabomen-db` |

## 5. DNS & Domain Mapping

### Cloud Run domain mappings

```bash
gcloud run domain-mappings create \
  --service=traumabomen-frontend \
  --domain=traumabomen.nl \
  --region=europe-west4

gcloud run domain-mappings create \
  --service=traumabomen-frontend \
  --domain=traumatrees.org \
  --region=europe-west4
```

Each command outputs required DNS records. Add them in the TransIP control panel.

### TransIP DNS records

Typically Cloud Run requires these (exact values come from the commands above):

| Domain | Type | Name | Value |
|---|---|---|---|
| traumabomen.nl | A | @ | (IP from gcloud output) |
| traumabomen.nl | AAAA | @ | (IPv6 from gcloud output) |
| traumabomen.nl | CNAME | www | ghs.googlehosted.com. |
| traumatrees.org | A | @ | (IP from gcloud output) |
| traumatrees.org | AAAA | @ | (IPv6 from gcloud output) |
| traumatrees.org | CNAME | www | ghs.googlehosted.com. |

SSL certificates are provisioned automatically by Cloud Run after DNS propagation (can take up to 24 hours, usually minutes).

### TransIP SMTP

Create a mailbox `noreply@traumabomen.nl` in TransIP's email panel. Use its credentials for the `smtp-user` and `smtp-password` secrets.

## 6. GitHub Actions Workflow

File: `.github/workflows/deploy.yml`

```yaml
name: Deploy to production

on:
  push:
    tags:
      - "v*"

env:
  REGISTRY: europe-west4-docker.pkg.dev
  IMAGE_PREFIX: europe-west4-docker.pkg.dev/${{ vars.GCP_PROJECT_ID }}/traumabomen

permissions:
  contents: read
  id-token: write  # Required for Workload Identity Federation

jobs:
  build-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
          service_account: ${{ vars.GCP_SERVICE_ACCOUNT }}

      - uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker
        run: gcloud auth configure-docker ${{ env.REGISTRY }} --quiet

      - name: Build and push API image
        run: |
          docker build --target production \
            -t ${{ env.IMAGE_PREFIX }}/api:${{ github.ref_name }} \
            -t ${{ env.IMAGE_PREFIX }}/api:latest \
            ./api
          docker push ${{ env.IMAGE_PREFIX }}/api:${{ github.ref_name }}
          docker push ${{ env.IMAGE_PREFIX }}/api:latest

  build-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
          service_account: ${{ vars.GCP_SERVICE_ACCOUNT }}

      - uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker
        run: gcloud auth configure-docker ${{ env.REGISTRY }} --quiet

      - name: Build and push frontend image
        run: |
          docker build --target production \
            -t ${{ env.IMAGE_PREFIX }}/frontend:${{ github.ref_name }} \
            -t ${{ env.IMAGE_PREFIX }}/frontend:latest \
            ./frontend
          docker push ${{ env.IMAGE_PREFIX }}/frontend:${{ github.ref_name }}
          docker push ${{ env.IMAGE_PREFIX }}/frontend:latest

  deploy:
    needs: [build-api, build-frontend]
    runs-on: ubuntu-latest
    steps:
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
          service_account: ${{ vars.GCP_SERVICE_ACCOUNT }}

      - uses: google-github-actions/setup-gcloud@v2

      # Run database migrations as a Cloud Run job
      - name: Run migrations
        run: |
          gcloud run jobs replace - <<EOF
          apiVersion: run.googleapis.com/v1
          kind: Job
          metadata:
            name: traumabomen-migrate
            annotations:
              run.googleapis.com/cloudsql-instances: ${{ vars.CLOUD_SQL_INSTANCE }}
          spec:
            template:
              spec:
                containers:
                  - image: ${{ env.IMAGE_PREFIX }}/api:${{ github.ref_name }}
                    command: ["uv", "run", "alembic", "upgrade", "head"]
                    env:
                      - name: DATABASE_URL
                        valueFrom:
                          secretKeyRef:
                            name: db-url
                            key: latest
          EOF
          gcloud run jobs execute traumabomen-migrate --region=${{ vars.GCP_REGION }} --wait

      # Deploy API
      - name: Deploy API
        run: |
          gcloud run deploy traumabomen-api \
            --image=${{ env.IMAGE_PREFIX }}/api:${{ github.ref_name }} \
            --region=${{ vars.GCP_REGION }} \
            --platform=managed \
            --allow-unauthenticated \
            --add-cloudsql-instances=${{ vars.CLOUD_SQL_INSTANCE }} \
            --set-secrets="\
              DATABASE_URL=db-url:latest,\
              JWT_SECRET_KEY=jwt-secret:latest,\
              SMTP_HOST=smtp-host:latest,\
              SMTP_PORT=smtp-port:latest,\
              SMTP_USER=smtp-user:latest,\
              SMTP_PASSWORD=smtp-password:latest" \
            --set-env-vars="\
              JWT_ALGORITHM=HS256,\
              REQUIRE_EMAIL_VERIFICATION=true,\
              SMTP_FROM=noreply@traumabomen.nl,\
              APP_BASE_URL=https://traumatrees.org" \
            --min-instances=0 \
            --max-instances=4 \
            --memory=256Mi \
            --cpu=1 \
            --timeout=60

      # Deploy frontend
      - name: Deploy frontend
        run: |
          API_URL=$(gcloud run services describe traumabomen-api \
            --region=${{ vars.GCP_REGION }} \
            --format="value(status.url)")

          gcloud run deploy traumabomen-frontend \
            --image=${{ env.IMAGE_PREFIX }}/frontend:${{ github.ref_name }} \
            --region=${{ vars.GCP_REGION }} \
            --platform=managed \
            --allow-unauthenticated \
            --set-env-vars="API_URL=${API_URL}" \
            --min-instances=0 \
            --max-instances=4 \
            --memory=128Mi \
            --cpu=1 \
            --timeout=60
```

## 7. File Changes

### `frontend/src/i18n.ts` -- hostname-based language detection

```typescript
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en/translation.json";
import nl from "./locales/nl/translation.json";

const hostnameDetector = {
  name: "hostname",
  lookup() {
    const host = window.location.hostname;
    if (host.endsWith("traumabomen.nl")) return "nl";
    if (host.endsWith("traumatrees.org")) return "en";
    return undefined;
  },
};

const languageDetector = new LanguageDetector();
languageDetector.addDetector(hostnameDetector);

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      nl: { translation: nl },
    },
    fallbackLng: "en",
    detection: {
      order: ["hostname", "localStorage", "navigator"],
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
```

Detection order:
1. `hostname` -- traumabomen.nl = nl, traumatrees.org = en
2. `localStorage` -- user's manual language override persists
3. `navigator` -- browser preference (localhost / dev fallback)

### `frontend/nginx.conf` -- API proxy with envsubst

```nginx
server {
    listen 8080;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /api/ {
        proxy_pass ${API_URL};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### `frontend/Dockerfile` -- envsubst for API_URL

```dockerfile
FROM node:22-alpine AS dev
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .

FROM dev AS build
RUN npm run build

FROM ghcr.io/dhi/nginx:stable AS production
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
```

Note: nginx's official Docker image (and the dhi variant) auto-runs `envsubst` on files in `/etc/nginx/templates/`, outputting to `/etc/nginx/conf.d/`. The `${API_URL}` placeholder is replaced with the env var at container startup. No custom entrypoint needed.

### `frontend/vite.config.ts` -- keep dev proxy working

The dev proxy in vite.config.ts (if any) continues to work as-is. The nginx proxy only applies to the production image. In dev, Vite's built-in proxy handles `/api/*` requests.

## 8. Rollback

```bash
# Roll back to a previous version
gcloud run deploy traumabomen-api \
  --image=europe-west4-docker.pkg.dev/traumabomen/traumabomen/api:v1.0.0 \
  --region=europe-west4

gcloud run deploy traumabomen-frontend \
  --image=europe-west4-docker.pkg.dev/traumabomen/traumabomen/frontend:v1.0.0 \
  --region=europe-west4
```

## 9. First Deploy Checklist

1. Create GCP project, enable APIs, create Artifact Registry (section 1)
2. Create Cloud SQL instance, database, user (section 2)
3. Create secrets in Secret Manager (section 3)
4. Set up Workload Identity Federation (section 4)
5. Add GitHub repository variables
6. Apply code changes: i18n.ts, nginx.conf, Dockerfile (section 7)
7. Commit, tag `v0.1.0`, push tag
8. GitHub Actions builds and deploys
9. Create domain mappings (section 5) -- requires services to exist first
10. Configure DNS at TransIP (section 5)
11. Wait for SSL provisioning
12. Verify both domains load the app with correct initial language

# Export compliance

## What the build already declares

`project.yml` sets:

```yaml
ITSAppUsesNonExemptEncryption: false
```

This is why TestFlight builds skip the compliance question. It ships in every
build, including the one you submit for public release.

## What the app actually does

- **AES-256-GCM** for content encryption
- **Argon2id** for deriving the key from the passphrase
- **TLS** for transport
- Apple's Keychain and Secure Enclave for key custody

All published, standard algorithms, used to protect the user's own data. No
proprietary or modified cryptography. The implementation is libsodium via the
Kotlin Multiplatform core.

## Why the declaration is plausible

That combination is the ordinary case for the exemption: standard encryption,
used for the app's own data protection, not offered as a cryptographic service
to others.

## Why you should still decide it yourself

Read this section rather than skipping it. Two reasons:

1. **It is a legal statement, not a form field.** You are declaring something
   about your software to a government. I can describe what the app does; I
   cannot tell you your obligations.
2. **The app's own README already flags it.** The note next to the key says to
   review the declaration before the first public release, which is now.

Worth reading Apple's own page before you answer:
https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations

France has additional national requirements that apply to some apps
distributed there, which is the usual reason an otherwise-exempt app needs
more paperwork. Check whether that touches you.

## If the answer changes

If you conclude the app is not exempt, change `ITSAppUsesNonExemptEncryption`
in `project.yml` rather than answering the question by hand in App Store
Connect: the key in the build wins, and a mismatch between the two is
confusing to debug later.

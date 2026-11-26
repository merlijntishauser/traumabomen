from __future__ import annotations

import base64
import hashlib
import hmac
import ipaddress
from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.guest_link import GuestLink, GuestLinkNetwork

_NETWORK_INFO = b"traumabomen/guest-network/v1"


def network_of(ip: str) -> str:
    """Reduce an address to its network: IPv4 as is, IPv6 to its /64."""
    addr = ipaddress.ip_address(ip)
    if isinstance(addr, ipaddress.IPv6Address):
        if addr.ipv4_mapped is not None:
            return str(addr.ipv4_mapped)
        net = ipaddress.ip_network(f"{addr}/64", strict=False)
        return f"{net.network_address}/64"
    return str(addr)


def network_hash(link_id: str, ip: str) -> str:
    """Hex HMAC of a link's visitor network; keyed so it cannot be reversed offline."""
    secret = get_settings().JWT_SECRET_KEY.encode()
    subkey = hmac.new(secret, _NETWORK_INFO, hashlib.sha256).digest()
    message = f"{link_id}|{network_of(ip)}".encode()
    return hmac.new(subkey, message, hashlib.sha256).hexdigest()


def hash_token(token: str) -> str:
    """Hex SHA-256 of the decoded (unpadded base64url) token bytes."""
    raw = base64.urlsafe_b64decode(token + "=" * (-len(token) % 4))
    return hashlib.sha256(raw).hexdigest()


async def sweep_expired_guest_links(db: AsyncSession) -> int:
    """Delete links past their expiry (networks cascade). Does not commit."""
    expired = select(GuestLink.id).where(GuestLink.expires_at <= datetime.now(UTC))
    # Explicit, so it holds on engines without foreign-key enforcement (test SQLite).
    await db.execute(delete(GuestLinkNetwork).where(GuestLinkNetwork.guest_link_id.in_(expired)))
    result = await db.execute(delete(GuestLink).where(GuestLink.id.in_(expired)))
    return int(result.rowcount or 0)  # type: ignore[attr-defined]

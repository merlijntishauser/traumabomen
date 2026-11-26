import hashlib
from unittest.mock import patch

from app.config import get_settings
from app.guest_links import hash_token, network_hash, network_of


def test_same_ipv4_same_hash():
    assert network_hash("L1", "203.0.113.5") == network_hash("L1", "203.0.113.5")


def test_different_ipv4_differs():
    assert network_hash("L1", "203.0.113.5") != network_hash("L1", "203.0.113.6")


def test_ipv6_same_64_matches():
    a = network_hash("L1", "2001:db8:1:2::1")
    b = network_hash("L1", "2001:db8:1:2:ffff::9")
    assert a == b


def test_ipv6_different_64_differs():
    assert network_hash("L1", "2001:db8:1:2::1") != network_hash("L1", "2001:db8:1:3::1")


def test_ipv4_mapped_ipv6_is_ipv4():
    assert network_of("::ffff:203.0.113.5") == "203.0.113.5"
    assert network_hash("L1", "::ffff:203.0.113.5") == network_hash("L1", "203.0.113.5")


def test_network_of_ipv6_is_64_prefix():
    assert network_of("2001:db8:1:2::1") == "2001:db8:1:2::/64"


def test_same_address_two_links_differs():
    assert network_hash("L1", "203.0.113.5") != network_hash("L2", "203.0.113.5")


def test_hash_hides_address_and_depends_on_secret():
    h1 = network_hash("L1", "203.0.113.5")
    assert "203.0.113.5" not in h1
    assert len(h1) == 64
    settings = get_settings()
    with patch.object(settings, "JWT_SECRET_KEY", settings.JWT_SECRET_KEY + "-other"):
        assert network_hash("L1", "203.0.113.5") != h1


def test_hash_token_is_sha256_of_decoded_bytes():
    raw = bytes(range(32))
    import base64

    token = base64.urlsafe_b64encode(raw).rstrip(b"=").decode()
    assert hash_token(token) == hashlib.sha256(raw).hexdigest()

"""Application user roles (DB `users.role` string values)."""

SUPER_ADMIN = "super_admin"
REGIONAL_MANAGER = "regional_manager"
FRANCHISE = "franchise"
USER = "user"

STAFF_ROLES = frozenset({SUPER_ADMIN, REGIONAL_MANAGER})

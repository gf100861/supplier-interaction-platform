# Permissions Without Microsoft Graph

## Principle

Use Microsoft 365 sign-in for identity, then use SharePoint list data for authorization. Do not query directory groups or user profile APIs.

## SharePoint Groups

Create these SharePoint site groups manually:

| Group | Permission | Members |
| --- | --- | --- |
| Action Portal Owners | Full Control | Admin builders |
| Action Portal Members | Edit | Internal Admin, Manager, SD users |
| Supplier Guests | Contribute | External supplier guests, if used |
| Action Portal Visitors | Read | Optional read-only viewers |

## App Role Source

The `UserRoles` list is the source of truth for app roles.

Minimum rows:

| Title | Email | Role | SupplierCode | IsActive |
| --- | --- | --- | --- | --- |
| Admin User | admin@company.com | Admin | | Yes |
| Manager User | manager@company.com | Manager | | Yes |
| SD User | sd@company.com | SD | | Yes |
| Supplier User | supplier@example.com | Supplier | SUP001 | Yes |

## Power Apps Start Logic

Use this on `App.OnStart`:

```powerfx
Set(varCurrentEmail, Lower(User().Email));
Set(
    varCurrentUserRoleRow,
    LookUp(UserRoles, Lower(Email) = varCurrentEmail && IsActive = true)
);
Set(varCurrentRole, Coalesce(varCurrentUserRoleRow.Role.Value, "Unauthorized"));
Set(varCurrentSupplierCode, Coalesce(varCurrentUserRoleRow.SupplierCode, ""));
ClearCollect(
    colMySupplierAssignments,
    Filter(
        SupplierAssignments,
        IsActive = true &&
        (Lower(SDUserEmail) = varCurrentEmail || Lower(ManagerEmail) = varCurrentEmail)
    )
);
```

## Navigation Guard

Use this on the first screen:

```powerfx
If(
    varCurrentRole = "Unauthorized",
    Navigate(scrUnauthorized),
    Navigate(scrDashboard)
)
```

## Role-Based Visibility

Admin:

```powerfx
varCurrentRole = "Admin"
```

Manager:

```powerfx
varCurrentRole in ["Admin", "Manager"]
```

SD:

```powerfx
varCurrentRole in ["Admin", "Manager", "SD"]
```

Supplier:

```powerfx
varCurrentRole = "Supplier"
```

## Notice Visibility Formula

Use this pattern for the main notice gallery:

```powerfx
Switch(
    varCurrentRole,
    "Admin",
        SortByColumns(Notices, "SubmittedAt", SortOrder.Descending),
    "Manager",
        SortByColumns(
            Filter(
                Notices,
                SupplierCode in colMySupplierAssignments.SupplierCode
            ),
            "SubmittedAt",
            SortOrder.Descending
        ),
    "SD",
        SortByColumns(
            Filter(
                Notices,
                SupplierCode in colMySupplierAssignments.SupplierCode
            ),
            "SubmittedAt",
            SortOrder.Descending
        ),
    "Supplier",
        SortByColumns(
            Filter(Notices, SupplierCode = varCurrentSupplierCode),
            "SubmittedAt",
            SortOrder.Descending
        ),
    Filter(Notices, false)
)
```

Note: `in` against a local collection can become nondelegable at scale. For large datasets, create a role-specific SharePoint view or use direct equality filters after selecting one supplier.

## Item-Level Security

Recommended baseline:

- SharePoint permissions protect broad access.
- Power Apps formulas hide non-authorized data in the app.
- For strict supplier isolation, create separate supplier folders/lists or use Power Automate item permission actions.

Avoid relying only on UI visibility for highly sensitive supplier data.


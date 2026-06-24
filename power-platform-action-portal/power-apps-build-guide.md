# Power Apps Build Guide

## App Type

Create a canvas app:

- Format: Tablet.
- Name: `SD Action Portal`.
- Data sources: the SharePoint lists and libraries from `sharepoint-schema.md`.

## Screens

Create these screens:

| Screen | Purpose |
| --- | --- |
| scrLoading | App startup and role loading |
| scrUnauthorized | No active role |
| scrDashboard | KPIs and quick actions |
| scrNoticeList | Search/filter notices |
| scrNoticeDetail | View notice detail |
| scrNoticeEdit | Create/edit notice |
| scrActionItems | Action item tracking |
| scrApprovals | Review/approve/reject |
| scrSuppliers | Supplier master and assignment view |
| scrAlerts | In-app alerts |
| scrAdmin | UserRoles and config admin |

## Global Variables

Set in `App.OnStart`:

```powerfx
Set(varCurrentEmail, Lower(User().Email));
Set(varCurrentUserRoleRow, LookUp(UserRoles, Lower(Email) = varCurrentEmail && IsActive = true));
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

## Main Navigation

Use a left navigation gallery with this `Items` formula:

```powerfx
Filter(
    Table(
        {Label: "Dashboard", Screen: scrDashboard, MinRole: "Any"},
        {Label: "Notices", Screen: scrNoticeList, MinRole: "Any"},
        {Label: "Actions", Screen: scrActionItems, MinRole: "Any"},
        {Label: "Approvals", Screen: scrApprovals, MinRole: "Manager"},
        {Label: "Suppliers", Screen: scrSuppliers, MinRole: "SD"},
        {Label: "Alerts", Screen: scrAlerts, MinRole: "Any"},
        {Label: "Admin", Screen: scrAdmin, MinRole: "Admin"}
    ),
    MinRole = "Any" ||
    (MinRole = "Manager" && varCurrentRole in ["Admin", "Manager"]) ||
    (MinRole = "SD" && varCurrentRole in ["Admin", "Manager", "SD"]) ||
    (MinRole = "Admin" && varCurrentRole = "Admin")
)
```

OnSelect:

```powerfx
Navigate(ThisItem.Screen)
```

## Dashboard KPIs

Open notices:

```powerfx
CountRows(Filter(Notices, Status.Value <> "Closed" && Status.Value <> "Archived"))
```

Overdue actions:

```powerfx
CountRows(Filter(ActionItems, Status.Value <> "Closed" && DueDate < Today()))
```

My pending approvals:

```powerfx
CountRows(Filter(Approvals, Lower(AssignedToEmail) = varCurrentEmail && Decision.Value = "Pending"))
```

## Notice List Gallery

Recommended controls:

- Text input: `txtSearch`.
- Dropdown: `ddStatus`.
- Dropdown: `ddSupplier`.
- Gallery: `galNotices`.

Use delegation-friendly filtering where possible:

```powerfx
SortByColumns(
    Filter(
        Notices,
        (IsBlank(ddStatus.Selected.Value) || Status.Value = ddStatus.Selected.Value) &&
        (IsBlank(ddSupplier.Selected.SupplierCode) || SupplierCode = ddSupplier.Selected.SupplierCode) &&
        (IsBlank(txtSearch.Text) || StartsWith(Title, txtSearch.Text))
    ),
    "SubmittedAt",
    SortOrder.Descending
)
```

For Supplier users, add `SupplierCode = varCurrentSupplierCode`.

## Create Notice

Use an Edit Form bound to `Notices`.

Submit button `OnSelect`:

```powerfx
SubmitForm(frmNoticeEdit)
```

Form `OnSuccess`:

```powerfx
Patch(
    SystemLogs,
    Defaults(SystemLogs),
    {
        Title: "Notice created",
        ActorEmail: varCurrentEmail,
        ActionType: {Value: "Create"},
        EntityType: {Value: "Notice"},
        EntityKey: frmNoticeEdit.LastSubmit.NoticeNo,
        Details: "Created from Power Apps"
    }
);
Navigate(scrNoticeDetail)
```

## Submit Notice

Submit button:

```powerfx
Patch(
    Notices,
    galNotices.Selected,
    {
        Status: {Value: "Submitted"},
        SubmittedAt: Now(),
        OwnerEmail: LookUp(SupplierAssignments, SupplierCode = galNotices.Selected.SupplierCode && IsActive = true).ManagerEmail
    }
);
Patch(
    Approvals,
    Defaults(Approvals),
    {
        Title: "Manager review - " & galNotices.Selected.NoticeNo,
        NoticeNo: galNotices.Selected.NoticeNo,
        Stage: {Value: "ManagerReview"},
        Decision: {Value: "Pending"},
        AssignedToEmail: LookUp(SupplierAssignments, SupplierCode = galNotices.Selected.SupplierCode && IsActive = true).ManagerEmail
    }
)
```

## Approve / Reject

Approve:

```powerfx
Patch(
    Approvals,
    galApprovals.Selected,
    {
        Decision: {Value: "Approved"},
        CompletedByEmail: varCurrentEmail,
        CompletedAt: Now(),
        Comments: txtApprovalComments.Text
    }
);
Patch(
    Notices,
    LookUp(Notices, NoticeNo = galApprovals.Selected.NoticeNo),
    {Status: {Value: "ActionRequired"}}
)
```

Reject:

```powerfx
Patch(
    Approvals,
    galApprovals.Selected,
    {
        Decision: {Value: "Rejected"},
        CompletedByEmail: varCurrentEmail,
        CompletedAt: Now(),
        Comments: txtApprovalComments.Text
    }
);
Patch(
    Notices,
    LookUp(Notices, NoticeNo = galApprovals.Selected.NoticeNo),
    {Status: {Value: "Rejected"}}
)
```

## Attachments

Simplest option:

- Use SharePoint form attachment controls on list forms where acceptable.

More controlled option:

- Store files in `NoticeAttachments`.
- Use Power Automate to create folders by `NoticeNo`.
- Store the folder URL in `Notices.AttachmentFolder`.

## Admin Screen

Admin screen should manage:

- `UserRoles`
- `Suppliers`
- `SupplierAssignments`
- Choice values if you store them in config lists later

Admin screen visible only when:

```powerfx
varCurrentRole = "Admin"
```


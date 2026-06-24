# Power Automate Flows

All core flows use Microsoft Forms and SharePoint connectors only. Do not use Microsoft Graph, Azure AD, Office 365 Users, Outlook, or Teams connectors in the core design.

If your IT/security team later confirms that Outlook or Teams connectors are allowed even under your no-Graph policy, you can add email or Teams notifications as optional extra actions. The portal must still work without them.

## Flow 1: Forms Intake to Notice

Trigger:

```text
Microsoft Forms - When a new response is submitted
```

Actions:

1. Microsoft Forms - Get response details.
2. SharePoint - Get items from `Suppliers`, filter by `SupplierCode`.
3. Condition: supplier exists.
4. SharePoint - Create item in `Notices`.
5. SharePoint - Create item in `SystemLogs`.
6. SharePoint - Create item in `PortalAlerts` for assigned SD/Manager.

Suggested Notice fields:

```text
Title = Issue Title
NoticeNo = AP-utcNow('yyyyMMddHHmmss')
SupplierCode = Supplier Code
CreatedByEmail = Contact Email
Status = Submitted
Priority = Priority
ProblemType = Problem Type
Description = Description
SubmittedAt = utcNow()
```

## Flow 2: Notice Submitted Notification

Trigger:

```text
SharePoint - When an item is created or modified
List: Notices
```

Condition:

```text
Status equals Submitted
```

Actions:

1. SharePoint - Get items from `SupplierAssignments` by `SupplierCode`.
2. SharePoint - Create item in `Approvals`.
3. SharePoint - Create item in `PortalAlerts`.
4. SharePoint - Create item in `SystemLogs`.

## Flow 3: Approval Reminder

Trigger:

```text
Recurrence - every weekday at 09:00
```

Actions:

1. SharePoint - Get items from `Approvals` where `Decision = Pending`.
2. Filter items older than your SLA.
3. Create `PortalAlerts`.
4. Create `SystemLogs`.

## Flow 4: Overdue Action Reminder

Trigger:

```text
Recurrence - daily
```

Actions:

1. SharePoint - Get items from `ActionItems` where `Status ne Closed`.
2. Filter `DueDate < utcNow()`.
3. Create `PortalAlerts` with `AlertType = Overdue`.
4. Create `SystemLogs`.

## Flow 5: Notice Closed Audit

Trigger:

```text
SharePoint - When an item is modified
List: Notices
```

Condition:

```text
Status equals Closed
```

Actions:

1. Update `ClosedAt` if blank.
2. Create `SystemLogs`.
3. Create `PortalAlerts` for creator and supplier contact.

## Flow 6: Attachment Folder Provisioning

Trigger:

```text
SharePoint - When an item is created
List: Notices
```

Actions:

1. SharePoint - Create new folder in `NoticeAttachments` named `NoticeNo`.
2. SharePoint - Update item in `Notices` with folder URL.
3. Create `SystemLogs`.

## Flow Ownership

Use a dedicated service account or automation owner allowed by your tenant policy. Conditional Access must be consistent for SharePoint and Power Automate, otherwise flow connections can fail authentication.

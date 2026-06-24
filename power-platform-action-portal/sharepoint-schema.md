# SharePoint Schema

Create these lists in the `SD Action Portal` SharePoint site.

Naming convention:

- Display names can be friendly.
- Internal names should avoid spaces.
- Use Choice columns for status and role values.
- Index all columns marked `Indexed`.

## 1. UserRoles

Purpose: replaces Graph/group lookup for app authorization.

| Column | Type | Required | Indexed | Notes |
| --- | --- | --- | --- | --- |
| Title | Single line text | Yes | No | Display name |
| Email | Single line text | Yes | Yes | Lowercase user email |
| Role | Choice | Yes | Yes | Admin, Manager, SD, Supplier |
| SupplierCode | Single line text | No | Yes | Required for Supplier users |
| Department | Single line text | No | No | Optional |
| IsActive | Yes/No | Yes | Yes | Default Yes |

Role values:

```text
Admin
Manager
SD
Supplier
```

## 2. Suppliers

Purpose: supplier master data.

| Column | Type | Required | Indexed | Notes |
| --- | --- | --- | --- | --- |
| Title | Single line text | Yes | Yes | Supplier legal name |
| SupplierCode | Single line text | Yes | Yes | Unique supplier code |
| ParmaId | Single line text | No | Yes | Existing PARMA ID |
| ShortCode | Single line text | No | Yes | Short display code |
| ContactEmail | Single line text | No | No | Main contact |
| Status | Choice | Yes | Yes | Active, Inactive |

## 3. SupplierAssignments

Purpose: controls which SD/Manager can see which suppliers.

| Column | Type | Required | Indexed | Notes |
| --- | --- | --- | --- | --- |
| Title | Single line text | Yes | No | `<SD email> - <SupplierCode>` |
| SupplierCode | Single line text | Yes | Yes | Matches Suppliers.SupplierCode |
| SDUserEmail | Single line text | No | Yes | Lowercase email |
| ManagerEmail | Single line text | No | Yes | Lowercase email |
| IsActive | Yes/No | Yes | Yes | Default Yes |

## 4. Notices

Purpose: main action/notice/problem records.

| Column | Type | Required | Indexed | Notes |
| --- | --- | --- | --- | --- |
| Title | Single line text | Yes | Yes | Notice title |
| NoticeNo | Single line text | Yes | Yes | Generated number |
| SupplierCode | Single line text | Yes | Yes | Matches Suppliers.SupplierCode |
| CreatedByEmail | Single line text | Yes | Yes | Lowercase email |
| OwnerEmail | Single line text | No | Yes | Current owner |
| Status | Choice | Yes | Yes | Draft, Submitted, InReview, Rejected, ActionRequired, Closed, Archived |
| Priority | Choice | No | Yes | Low, Medium, High, Critical |
| ProblemType | Choice | No | Yes | Define local issue categories |
| DueDate | Date only | No | Yes | Action due date |
| SubmittedAt | Date and time | No | Yes | Submission timestamp |
| ClosedAt | Date and time | No | Yes | Closure timestamp |
| Description | Multiple lines text | No | No | Plain text |
| RootCause | Multiple lines text | No | No | Supplier/SD input |
| CorrectiveAction | Multiple lines text | No | No | Action response |
| ManagerComment | Multiple lines text | No | No | Review notes |
| AttachmentFolder | Hyperlink | No | No | Link to library folder |

Status values:

```text
Draft
Submitted
InReview
Rejected
ActionRequired
Closed
Archived
```

## 5. ActionItems

Purpose: detailed action tracking linked to Notices.

| Column | Type | Required | Indexed | Notes |
| --- | --- | --- | --- | --- |
| Title | Single line text | Yes | No | Action summary |
| NoticeNo | Single line text | Yes | Yes | Link by text for delegation |
| SupplierCode | Single line text | Yes | Yes | Denormalized for filtering |
| OwnerEmail | Single line text | Yes | Yes | Current owner |
| Status | Choice | Yes | Yes | Open, InProgress, Submitted, Approved, Rejected, Closed |
| DueDate | Date only | No | Yes | Due date |
| CompletionDate | Date only | No | Yes | Completed date |
| ActionDetail | Multiple lines text | No | No | Description |
| EvidenceLink | Hyperlink | No | No | Attachment link |

## 6. Approvals

Purpose: review history without relying only on Power Automate approval records.

| Column | Type | Required | Indexed | Notes |
| --- | --- | --- | --- | --- |
| Title | Single line text | Yes | No | Approval summary |
| NoticeNo | Single line text | Yes | Yes | Related notice |
| Stage | Choice | Yes | Yes | ManagerReview, SupplierResponse, SDClosure |
| Decision | Choice | Yes | Yes | Pending, Approved, Rejected, Returned |
| AssignedToEmail | Single line text | Yes | Yes | Approver |
| CompletedByEmail | Single line text | No | Yes | Actual actor |
| CompletedAt | Date and time | No | Yes | Completion timestamp |
| Comments | Multiple lines text | No | No | Notes |

## 7. PortalAlerts

Purpose: in-app notifications.

| Column | Type | Required | Indexed | Notes |
| --- | --- | --- | --- | --- |
| Title | Single line text | Yes | No | Alert title |
| TargetEmail | Single line text | Yes | Yes | Lowercase email |
| NoticeNo | Single line text | No | Yes | Related notice |
| Message | Multiple lines text | No | No | Body |
| IsRead | Yes/No | Yes | Yes | Default No |
| AlertType | Choice | No | Yes | Info, Warning, Approval, Overdue |

## 8. SystemLogs

Purpose: audit trail.

| Column | Type | Required | Indexed | Notes |
| --- | --- | --- | --- | --- |
| Title | Single line text | Yes | No | Log title |
| ActorEmail | Single line text | No | Yes | Lowercase email |
| ActionType | Choice | Yes | Yes | Create, Update, Submit, Approve, Reject, Upload, Close |
| EntityType | Choice | Yes | Yes | Notice, ActionItem, Supplier, UserRole, System |
| EntityKey | Single line text | No | Yes | NoticeNo or other key |
| Details | Multiple lines text | No | No | JSON or plain text |

## Document Libraries

Create these libraries:

| Library | Purpose | Folder Pattern |
| --- | --- | --- |
| NoticeAttachments | Files uploaded for notice/action records | `/NoticeNo/filename` |
| IntakeAttachments | Files from Forms intake, if enabled | `/FormResponseId/filename` |
| Reports | Exported or manual reports | `/yyyy-mm/filename` |

## Required Indexes

Create SharePoint indexes on these high-use columns:

```text
UserRoles.Email
UserRoles.Role
UserRoles.IsActive
Suppliers.SupplierCode
SupplierAssignments.SupplierCode
SupplierAssignments.SDUserEmail
SupplierAssignments.ManagerEmail
SupplierAssignments.IsActive
Notices.NoticeNo
Notices.SupplierCode
Notices.CreatedByEmail
Notices.OwnerEmail
Notices.Status
Notices.DueDate
ActionItems.NoticeNo
ActionItems.SupplierCode
ActionItems.OwnerEmail
ActionItems.Status
Approvals.NoticeNo
Approvals.AssignedToEmail
PortalAlerts.TargetEmail
PortalAlerts.IsRead
SystemLogs.ActorEmail
SystemLogs.EntityKey
```


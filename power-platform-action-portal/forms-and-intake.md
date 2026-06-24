# Forms and Intake

Microsoft Forms should be used as a lightweight intake channel, not as the main portal UI.

## Form 1: Supplier Action Intake

Create a form named:

```text
Supplier Action Intake
```

Questions:

| Question | Type | Required | Maps To |
| --- | --- | --- | --- |
| Supplier Code | Text | Yes | Notices.SupplierCode |
| Contact Email | Text | Yes | Notices.CreatedByEmail or metadata |
| Issue Title | Text | Yes | Notices.Title |
| Problem Type | Choice | No | Notices.ProblemType |
| Priority | Choice | No | Notices.Priority |
| Description | Long text | Yes | Notices.Description |
| Due Date | Date | No | Notices.DueDate |
| Attachment | File upload | No | IntakeAttachments / NoticeAttachments |

## Form 2: Supplier Corrective Action Response

Questions:

| Question | Type | Required | Maps To |
| --- | --- | --- | --- |
| Notice Number | Text | Yes | Notices.NoticeNo |
| Supplier Code | Text | Yes | Notices.SupplierCode |
| Root Cause | Long text | Yes | Notices.RootCause |
| Corrective Action | Long text | Yes | Notices.CorrectiveAction |
| Completion Date | Date | No | ActionItems.CompletionDate |
| Evidence Attachment | File upload | No | NoticeAttachments |

## Power Automate Forms Pattern

Each form should use:

1. Trigger: Microsoft Forms - When a new response is submitted.
2. Action: Microsoft Forms - Get response details.
3. Action: SharePoint - Create item or Update item.
4. Action: SharePoint - Create item in `SystemLogs`.
5. Optional action: Send email notification.

Forms provides one trigger, `When a new response is submitted`, and one response details action in Power Automate. Keep mappings simple and explicit.

## Validation Without Graph

Do not validate user identity by Graph.

Instead:

- Validate `Supplier Code` against the `Suppliers` list.
- Validate submitted email against `UserRoles` if the respondent must already be registered.
- If external anonymous Forms are allowed, mark the item as `Submitted` but route it to SD triage before supplier-visible workflow starts.

## Intake Status Recommendation

For Form-created notices:

```text
DraftFromForm -> Submitted -> InReview
```

If the intake is anonymous or untrusted:

```text
NeedsTriage -> Submitted
```


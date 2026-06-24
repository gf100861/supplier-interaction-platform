# Acceptance Checklist

Use this checklist before treating the Power Platform Action Portal as ready.

## SharePoint

- [ ] Dedicated SharePoint site exists.
- [ ] All lists in `sharepoint-schema.md` exist.
- [ ] All required columns exist with correct types.
- [ ] Choice values are configured.
- [ ] Required indexes are created.
- [ ] Document libraries exist.
- [ ] `UserRoles` contains at least one Admin row.
- [ ] Supplier test data exists.
- [ ] Supplier assignment test data exists.

## Permissions

- [ ] SharePoint groups exist.
- [ ] Internal users have site/list access.
- [ ] Supplier guests, if needed, can access only intended resources.
- [ ] No app logic uses Microsoft Graph.
- [ ] No app logic uses Office 365 Users or Azure AD connector.
- [ ] Core flows do not depend on Outlook or Teams connectors.

## Power Apps

- [ ] App loads for Admin, Manager, SD, and Supplier test users.
- [ ] Unauthorized users see the unauthorized screen.
- [ ] Admin sees admin screen.
- [ ] Supplier sees only their supplier records.
- [ ] Manager/SD sees assigned supplier records.
- [ ] Create notice works.
- [ ] Submit notice works.
- [ ] Approve/reject works.
- [ ] Action item update works.
- [ ] Alerts screen shows unread alerts.

## Forms

- [ ] Supplier Action Intake creates a notice.
- [ ] Corrective Action Response updates the correct notice/action item.
- [ ] Invalid supplier code routes to triage or fails gracefully.

## Power Automate

- [ ] Forms intake flow succeeds.
- [ ] Notice submitted notification flow succeeds.
- [ ] Approval reminder flow succeeds.
- [ ] Overdue reminder flow succeeds.
- [ ] Attachment folder flow succeeds.
- [ ] System logs are written for key actions.

## Performance

- [ ] Main galleries use indexed/delegable filters.
- [ ] No screen loads all rows unnecessarily.
- [ ] Large text search is limited to StartsWith or handled through SharePoint views.
- [ ] Lists expected to exceed 5,000 items have indexes and filtered views.

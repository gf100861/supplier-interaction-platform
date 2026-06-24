# Power Platform Action Portal Setup Kit

This kit describes how to rebuild the Action Portal with Power Apps, Microsoft Forms, SharePoint, and Power Automate without using Microsoft Graph.

## Scope

Target components:

- Power Apps canvas app: main Action Portal UI.
- SharePoint Lists: structured business data.
- SharePoint Document Libraries: attachments and reports.
- Microsoft Forms: lightweight intake forms.
- Power Automate: workflow, notification, reminder, and audit automation.

Explicitly excluded:

- Microsoft Graph.
- Office 365 Users / Azure AD connector dependency for role lookup.
- Outlook/Teams notification dependency in the core design.
- Custom backend code.
- Rebuilding the existing React UI pixel by pixel.

## Build Order

1. Create a SharePoint site named `SD Action Portal`.
2. Create the SharePoint lists and libraries in `sharepoint-schema.md`.
3. Configure list indexes and permissions in `permissions-no-graph.md`.
4. Build the Power Apps canvas app using `power-apps-build-guide.md`.
5. Create Microsoft Forms using `forms-and-intake.md`.
6. Create Power Automate flows using `power-automate-flows.md`.
7. Run the acceptance checklist in `acceptance-checklist.md`.

## Recommended Site URL Pattern

Use one dedicated SharePoint site:

```text
https://<tenant>.sharepoint.com/sites/SDActionPortal
```

Use clear list names. Do not use spaces in internal names when possible.

## No-Graph Design

Authentication comes from normal Microsoft 365 sign-in. Authorization is handled inside the app:

```powerfx
Set(varCurrentEmail, Lower(User().Email));
Set(varCurrentRole, LookUp(UserRoles, Lower(Email) = varCurrentEmail && IsActive = true).Role.Value);
```

Supplier visibility is also list-driven:

```powerfx
ClearCollect(
    colMySupplierAssignments,
    Filter(SupplierAssignments, Lower(SDUserEmail) = varCurrentEmail || Lower(ManagerEmail) = varCurrentEmail)
);
```

This avoids querying directory groups or user profiles through Graph.

## Key Platform Constraints

- SharePoint is suitable for workflow data, not heavy analytics or full-text search at database scale.
- Use indexed columns for every field used in major filters.
- Avoid nondelegable Power Apps formulas on large lists.
- Keep complex reporting in SharePoint views, Power BI, or exported Excel if the list grows large.
- External suppliers need tenant guest access and Power Apps/SharePoint permissions configured by an admin.
- Core notifications are stored in the `PortalAlerts` SharePoint list. Email or Teams notifications should be added only if your tenant explicitly allows those connectors under your no-Graph policy.

Microsoft references:

- Power Apps can connect to SharePoint lists from the Data menu and supports SharePoint list data sources.
- Forms in Power Automate provides a submission trigger and response-details action.
- Power Automate supports SharePoint workflows for approvals, files, and list items.
- Canvas apps can be shared with Microsoft Entra guest users when tenant external collaboration is enabled.

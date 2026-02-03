{{ date }}

{{ tenant_name }}
{{ tenant_address_full }}
&nbsp;
&nbsp;
&nbsp;
{{ landlord_name }}
{{ landlord_address_full }}

Dear {{ landlord_name }},

Since receiving the "landlord's use" eviction notice you sent me, I have found a new place to live and will be moving out before the effective date of the notice. This letter serves as written notice to end my tenancy at the above noted address. The last day of my tenancy will be {{ tenancy_end_date | formatDate }}.

Please refer to section 50 of the Residential Tenancy Act (RTA):

* If a landlord gives a tenant notice to end a periodic tenancy under section 49 [landlord's use of property] or 49.1 [landlord's notice: tenant ceases to qualify], the tenant may end the tenancy early by
  * giving the landlord at least 10 days' written notice to end the tenancy on a date that is earlier than the effective date of the landlord's notice, and
  * paying the landlord, on the date the tenant's notice is given, the proportion of the rent due to the effective date of the tenant's notice, unless subsection (2) applies.
* If the tenant paid rent before giving a notice under subsection (1), on receiving the tenant's notice, the landlord must refund any rent paid for a period after the effective date of the tenant's notice.
* A notice under this section does not affect the tenant's right to compensation under section 51 [tenant's compensation: section 49 notice].

I have already paid my full rent for this month and will need to be reimbursed for the days after our tenancy ends. Based on the move-out day listed above, you will owe me {{ prorated_rent_refund | money }} for the prorated rent. Additionally, section 51 of the RTA requires you to pay me one-month rent ({{ monthly_rent | money }}) as compensation for the last month of my notice. Please provide me with payment of {{ total_owed | money }} by the last day of my tenancy.

As required by section 35 of the RTA, please schedule a time to complete a move-out condition inspection on the last day of the tenancy.

My forwarding address for the return of my security deposit and/or pet damage deposit is:
{{ tenant_forwarding_address_full }}

For additional information, please contact the RTB (gov.bc.ca/landlordtenant) at 604-660-1020 or 1-800-665-8779.

Thank you,

{{ tenant_name }}

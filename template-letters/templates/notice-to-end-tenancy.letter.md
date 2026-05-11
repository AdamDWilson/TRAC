{{ date }}

{{ tenant_name }}
{{ tenant_address_full }}
&nbsp;
&nbsp;
&nbsp;
{{ landlord_name }}
{{ landlord_address_full }}

Dear {{ landlord_name }},

This letter serves as written notice to end my month-to-month tenancy at the address listed above. The last day of my tenancy will be {{ tenancy_end_date | formatDate }}.

Section 45(1) of the Residential Tenancy Act (RTA) states:
* A tenant may end a periodic tenancy by giving the landlord notice to end the tenancy effective on a date that
* is not earlier than one month after the date the landlord receives the notice, and
* is the day before the day in the month, or in the other period on which the tenancy is based, that rent is payable under the tenancy agreement.

{% if has_security_deposit %}
According to section 38 of the RTA, my security deposit and/or pet damage deposit of {% if deposit_calculation_supported %}{{ deposit_amount | depositInterest(tenancy_start_date) | money }}{% else %}{{ manual_deposit_return_amount | money }}{% endif %} Total is to be returned within 15 days after you have received my forwarding address in writing and my tenancy has officially ended. This amount also includes any interest that has accumulated on the initial deposit. I calculated this amount using the Residential Tenancy Branch's (RTB) Deposit Interest Calculator, which can be accessed at gov.bc.ca/landlordtenant.

{% if deposit_return_method == "Mail" %}
The forwarding address to which my deposit(s) can be mailed to is:
{{ tenant_forwarding_address_full }}
{% elif deposit_return_method == "E-Transfer" %}
Please send my deposit via e-transfer to:
{{ tenant_forwarding_email }}
{% endif %}
{% endif %}

If you wish to show my rental unit to prospective tenants before I move out, please contact me so we can arrange a workable schedule.

For additional information, please contact the RTB (gov.bc.ca/landlordtenant) at 604-660-1020 or 1-800-665-8779.

Thank you,

{{ tenant_name }}

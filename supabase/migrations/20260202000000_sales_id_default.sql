alter table public.companies alter column sales_id set default 1;
update public.companies set sales_id = 1 where sales_id is null;
alter table public.companies drop constraint if exists companies_sales_id_fkey;
alter table public.companies
  add constraint companies_sales_id_fkey
  foreign key (sales_id) references public.sales(id)
  on update cascade on delete set default;

alter table public.contacts alter column sales_id set default 1;
update public.contacts set sales_id = 1 where sales_id is null;
alter table public.contacts drop constraint if exists contacts_sales_id_fkey;
alter table public.contacts
  add constraint contacts_sales_id_fkey
  foreign key (sales_id) references public.sales(id)
  on update cascade on delete set default;

alter table public.deals alter column sales_id set default 1;
update public.deals set sales_id = 1 where sales_id is null;
alter table public.deals drop constraint if exists deals_sales_id_fkey;
alter table public.deals
  add constraint deals_sales_id_fkey
  foreign key (sales_id) references public.sales(id)
  on update cascade on delete set default;

alter table public."contactNotes" alter column sales_id set default 1;
update public."contactNotes" set sales_id = 1 where sales_id is null;
alter table public."contactNotes" drop constraint if exists "contactNotes_sales_id_fkey";
alter table public."contactNotes"
  add constraint "contactNotes_sales_id_fkey"
  foreign key (sales_id) references public.sales(id)
  on update cascade on delete set default;

alter table public."dealNotes" alter column sales_id set default 1;
update public."dealNotes" set sales_id = 1 where sales_id is null;
alter table public."dealNotes" drop constraint if exists "dealNotes_sales_id_fkey";
alter table public."dealNotes"
  add constraint "dealNotes_sales_id_fkey"
  foreign key (sales_id) references public.sales(id)
  on update cascade on delete set default;

alter table public.tasks alter column sales_id set default 1;
update public.tasks set sales_id = 1 where sales_id is null;
alter table public.tasks drop constraint if exists tasks_sales_id_fkey;
alter table public.tasks
  add constraint tasks_sales_id_fkey
  foreign key (sales_id) references public.sales(id)
  on update cascade on delete set default;

create policy "Enable delete for administrators" on public.sales
for delete
to authenticated
using (
  exists (
    select 1
    from public.sales s
    where s.user_id = auth.uid()
      and s.administrator = true
  )
);

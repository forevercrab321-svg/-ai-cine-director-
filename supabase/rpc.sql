-- Create a function to deduct credits safely
create or replace function public.deduct_credits(amount_to_deduct integer)
returns boolean
language plpgsql
security definer
as $$
declare
  current_credits integer;
begin
  -- Check if user has enough credits
  select credits into current_credits
  from public.profiles
  where id = auth.uid();

  if current_credits >= amount_to_deduct then
    update public.profiles
    set credits = credits - amount_to_deduct
    where id = auth.uid();
    return true;
  else
    return false;
  end if;
end;
$$;

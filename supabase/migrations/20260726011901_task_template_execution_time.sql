alter table public.task_templates
  add column if not exists due_time time,
  add column if not exists end_time time;

alter table public.task_templates
  drop constraint if exists task_templates_execution_window_check;

alter table public.task_templates
  add constraint task_templates_execution_window_check
  check (due_time is null or end_time is null or end_time > due_time);

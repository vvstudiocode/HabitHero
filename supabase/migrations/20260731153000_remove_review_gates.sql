-- Review remains part of the completion and points flow, but pending or
-- revision-requested work must never lock another task.

drop trigger if exists tasks_review_gate_guard on public.tasks;
drop function if exists private.enforce_task_review_gate();

update public.tasks
set requires_review_before_next_task = false
where requires_review_before_next_task;

update public.task_templates
set requires_review_before_next_task = false
where requires_review_before_next_task;

update public.task_schedules
set requires_review_before_next_task = false
where requires_review_before_next_task;

alter table public.tasks
  drop constraint if exists tasks_review_gate_disabled,
  add constraint tasks_review_gate_disabled
    check (requires_review_before_next_task = false);

alter table public.task_templates
  drop constraint if exists task_templates_review_gate_disabled,
  add constraint task_templates_review_gate_disabled
    check (requires_review_before_next_task = false);

alter table public.task_schedules
  drop constraint if exists task_schedules_review_gate_disabled,
  add constraint task_schedules_review_gate_disabled
    check (requires_review_before_next_task = false);

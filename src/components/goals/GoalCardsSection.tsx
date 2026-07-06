// src/components/goals/GoalCardsSection.tsx
//
// The Goal Cards column. Renders active goals (or all, when showAll),
// with grip-handle reordering via dnd-kit — reliable on desktop AND
// iOS Safari (the TouchSensor's activation delay distinguishes a drag
// from a scroll, and touch-action:none on the grip stops the page
// scrolling once the drag begins). A DragOverlay renders a floating
// copy of the card for the "lifted" drag feel. Tapping a card expands
// its GoalSavingsChart inline (laptop only).
//
// Install once:
//   npm i @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

import { useState, useEffect, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { GoalCard } from '@/components/goals/GoalCard'
import { GoalSavingsChart } from '@/components/goals/GoalSavingsChart'
import type { EnrichedGoal } from '@/hooks/useGoalsEnriched'
import { useReorderGoals } from '@/hooks/useGoalMutations'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Props {
  goals:          EnrichedGoal[]   // already filtered (active or all) + sorted
  isLaptop:       boolean
  onOpenSettings: (goal: EnrichedGoal) => void
}

export function GoalCardsSection({ goals, isLaptop, onOpenSettings }: Props) {
  const reorder = useReorderGoals()

  // Local order for optimistic drag; synced from props when they change.
  const [order, setOrder] = useState<EnrichedGoal[]>(goals)
  useEffect(() => { setOrder(goals) }, [goals])

  const [openChartId, setOpenChartId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    // Desktop: small movement threshold so a click still registers as a click.
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // Touch (iOS): brief press-and-hold to start; a scroll gesture (finger
    // moves past the tolerance before the delay elapses) cancels the drag.
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function toggleChart(id: string) {
    if (!isLaptop) return   // chart is laptop-only per spec
    setOpenChartId(prev => (prev === id ? null : id))
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
    setOpenChartId(null)    // collapse any open chart while dragging
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveId(null)
    if (!over || active.id === over.id) return
    setOrder(prev => {
      const from = prev.findIndex(g => g.id === active.id)
      const to   = prev.findIndex(g => g.id === over.id)
      if (from === -1 || to === -1) return prev
      const next = arrayMove(prev, from, to)
      // Persist new sort_order (0-based, in the new visual order).
      reorder.mutate(next.map((g, i) => ({ id: g.id, sort_order: i })))
      return next
    })
  }

  if (order.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line py-16 px-6 text-center">
        <span className="text-4xl mb-3">🎯</span>
        <p className="font-sora text-sm font-semibold text-white mb-1">No goals yet</p>
        <p className="font-dm text-xs text-soft">Tap + to create your first savings goal.</p>
      </div>
    )
  }

  const activeGoal = activeId ? order.find(g => g.id === activeId) ?? null : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={order.map(g => g.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-3">
          {order.map(goal => (
            <SortableGoalRow
              key={goal.id}
              goal={goal}
              isLaptop={isLaptop}
              chartOpen={openChartId === goal.id}
              onToggleChart={() => toggleChart(goal.id)}
              onOpenSettings={() => onOpenSettings(goal)}
            />
          ))}
        </div>
      </SortableContext>

      {/* Floating copy of the dragged card — the "lifted" visual feel */}
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18,0.67,0.6,1.22)' }}>
        {activeGoal ? (
          <div className="rotate-1 shadow-2xl shadow-black/40">
            <GoalCard
              goal={activeGoal}
              chartOpen={false}
              onToggleChart={() => {}}
              onOpenSettings={() => {}}
              isDragging
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// ── One sortable card row ───────────────────────────────────────────
function SortableGoalRow({ goal, isLaptop, chartOpen, onToggleChart, onOpenSettings }: {
  goal: EnrichedGoal
  isLaptop: boolean
  chartOpen: boolean
  onToggleChart: () => void
  onOpenSettings: () => void
}) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging,
  } = useSortable({ id: goal.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && 'opacity-40')}>
      <GoalCard
        goal={goal}
        chartOpen={chartOpen}
        onToggleChart={onToggleChart}
        onOpenSettings={onOpenSettings}
        isDragging={isDragging}
        dragHandleRef={setActivatorNodeRef}
        dragHandleProps={{ ...attributes, ...listeners } as HTMLAttributes<HTMLButtonElement>}
      />

      {/* Inline chart (laptop only), hidden while dragging */}
      {isLaptop && chartOpen && !isDragging && (
        <div className="mt-2 animate-fade-in-scale">
          <GoalSavingsChart goalName={goal.goal_name} />
        </div>
      )}
    </div>
  )
}

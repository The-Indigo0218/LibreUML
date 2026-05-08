import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import { useUiStore } from '../../../../store/uiStore';
import { useModelStore } from '../../../../store/model.store';
import { useVFSStore } from '../../../../store/project-vfs.store';
import { useWorkspaceStore } from '../../../../store/workspace.store';
import { standaloneModelOps, getLocalModel } from '../../../../store/standaloneModelOps';
import type { IRUseCase, UseCaseFlowStep, UseCaseAltFlow } from '../../../../core/domain/vfs/vfs.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newStep(stepNumber: number): UseCaseFlowStep {
  return { id: crypto.randomUUID(), stepNumber, description: '' };
}

function newAltFlow(): UseCaseAltFlow {
  return { id: crypto.randomUUID(), name: '', trigger: '', steps: [newStep(1)] };
}

type Tab = 'description' | 'flows' | 'extensions';

// ─── Step list editor ─────────────────────────────────────────────────────────

function StepList({
  steps,
  onChange,
}: {
  steps: UseCaseFlowStep[];
  onChange: (steps: UseCaseFlowStep[]) => void;
}) {
  const add = () => onChange([...steps, newStep(steps.length + 1)]);
  const remove = (id: string) => {
    const next = steps.filter((s) => s.id !== id).map((s, i) => ({ ...s, stepNumber: i + 1 }));
    onChange(next);
  };
  const update = (id: string, description: string) =>
    onChange(steps.map((s) => (s.id === id ? { ...s, description } : s)));

  return (
    <div className="space-y-1.5">
      {steps.map((step) => (
        <div key={step.id} className="flex items-start gap-2 group">
          <GripVertical className="w-4 h-4 mt-2 text-[#374151] shrink-0" />
          <span className="mt-2 text-xs text-[#475569] shrink-0 w-5 text-right">{step.stepNumber}.</span>
          <input
            value={step.description}
            onChange={(e) => update(step.id, e.target.value)}
            placeholder={`Paso ${step.stepNumber}…`}
            className="flex-1 px-2 py-1.5 bg-[#0f1419] border border-[#2a3358] rounded text-[#e2e8f0] text-sm placeholder-[#374151] focus:outline-none focus:border-[#7C83FF]"
          />
          <button
            onClick={() => remove(step.id)}
            className="mt-1.5 p-1 opacity-0 group-hover:opacity-100 hover:text-red-400 text-[#475569] transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-1 text-xs text-[#7C83FF] hover:text-[#9499ff] transition-colors mt-1"
      >
        <Plus className="w-3.5 h-3.5" /> Agregar paso
      </button>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function UseCaseSpecModal() {
  const { activeModal, editingId, closeModals } = useUiStore();
  const isOpen = activeModal === 'use-case-spec' && !!editingId;

  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const project = useVFSStore((s) => s.project);
  const isStandalone = !!(
    activeTabId &&
    project?.nodes[activeTabId] &&
    (project.nodes[activeTabId] as any).standalone === true
  );

  // ── Load UC from model ──────────────────────────────────────────────────────
  const getUC = useCallback((): IRUseCase | null => {
    if (!editingId) return null;
    if (isStandalone && activeTabId) {
      return getLocalModel(activeTabId)?.useCases?.[editingId] ?? null;
    }
    return useModelStore.getState().model?.useCases?.[editingId] ?? null;
  }, [editingId, isStandalone, activeTabId]);

  // ── Local state (form) ──────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>('description');
  const [name, setName] = useState('');
  const [briefDescription, setBriefDescription] = useState('');
  const [preconditions, setPreconditions] = useState('');
  const [postconditions, setPostconditions] = useState('');
  const [trigger, setTrigger] = useState('');
  const [basicFlow, setBasicFlow] = useState<UseCaseFlowStep[]>([]);
  const [altFlows, setAltFlows] = useState<UseCaseAltFlow[]>([]);
  const [extensionPoints, setExtensionPoints] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const uc = getUC();
    if (!uc) return;
    setName(uc.name);
    setBriefDescription(uc.briefDescription ?? '');
    setPreconditions(uc.preconditions ?? '');
    setPostconditions(uc.postconditions ?? '');
    setTrigger(uc.trigger ?? '');
    setBasicFlow(uc.basicFlow ?? []);
    setAltFlows(uc.alternativeFlows ?? []);
    setExtensionPoints(uc.extensionPoints ?? []);
    setTab('description');
  }, [isOpen, editingId]);

  if (!isOpen) return null;

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!editingId) return;
    const patch: Partial<IRUseCase> = {
      name: name.trim() || 'UseCase',
      briefDescription: briefDescription || undefined,
      preconditions: preconditions || undefined,
      postconditions: postconditions || undefined,
      trigger: trigger || undefined,
      basicFlow: basicFlow.filter((s) => s.description.trim()),
      alternativeFlows: altFlows.filter((f) => f.name.trim()),
      extensionPoints: extensionPoints.filter(Boolean),
    };
    if (isStandalone && activeTabId) {
      standaloneModelOps(activeTabId).updateUseCase(editingId, patch);
    } else {
      useModelStore.getState().updateUseCase(editingId, patch);
    }
    closeModals();
  };

  // ── Alt flow helpers ────────────────────────────────────────────────────────
  const updateAltFlow = (id: string, patch: Partial<UseCaseAltFlow>) =>
    setAltFlows((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
      onClick={closeModals}
    >
      <div
        className="bg-[#161d2f] border border-[#2a3358] shadow-2xl rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && closeModals()}
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[#64748b] text-sm">Use Case:</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-transparent text-[#e2e8f0] text-lg font-semibold focus:outline-none border-b border-transparent focus:border-[#7C83FF] transition-colors min-w-0 max-w-[320px]"
            />
          </div>
          <button onClick={closeModals} className="p-1 hover:bg-[#1e2738] rounded text-[#64748b] hover:text-[#e2e8f0] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 px-5 border-b border-[#2a3358] shrink-0">
          {([
            ['description', 'Descripción'],
            ['flows', 'Flujos'],
            ['extensions', 'Ext. Points'],
          ] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === t
                  ? 'border-[#7C83FF] text-[#7C83FF]'
                  : 'border-transparent text-[#64748b] hover:text-[#94a3b8]',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Body ───────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {tab === 'description' && (
            <>
              <Field label="Descripción breve">
                <textarea
                  value={briefDescription}
                  onChange={(e) => setBriefDescription(e.target.value)}
                  rows={3}
                  placeholder="¿Qué hace este use case?"
                  className={TEXTAREA_CLASS}
                />
              </Field>
              <Field label="Disparador (Trigger)">
                <input
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value)}
                  placeholder="¿Qué inicia este use case?"
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Precondiciones">
                <textarea
                  value={preconditions}
                  onChange={(e) => setPreconditions(e.target.value)}
                  rows={3}
                  placeholder="Condiciones que deben cumplirse antes de ejecutar el use case"
                  className={TEXTAREA_CLASS}
                />
              </Field>
              <Field label="Postcondiciones">
                <textarea
                  value={postconditions}
                  onChange={(e) => setPostconditions(e.target.value)}
                  rows={3}
                  placeholder="Estado del sistema después de completarse el use case"
                  className={TEXTAREA_CLASS}
                />
              </Field>
            </>
          )}

          {tab === 'flows' && (
            <>
              <Field label="Flujo básico (happy path)">
                <StepList
                  steps={basicFlow}
                  onChange={setBasicFlow}
                />
              </Field>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={LABEL_CLASS}>Flujos alternativos</label>
                  <button
                    onClick={() => setAltFlows((p) => [...p, newAltFlow()])}
                    className="flex items-center gap-1 text-xs text-[#7C83FF] hover:text-[#9499ff] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar flujo
                  </button>
                </div>
                <div className="space-y-4">
                  {altFlows.map((af) => (
                    <div key={af.id} className="rounded border border-[#2a3358] bg-[#0f1419] p-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          value={af.name}
                          onChange={(e) => updateAltFlow(af.id, { name: e.target.value })}
                          placeholder="Nombre del flujo alternativo"
                          className={`${INPUT_CLASS} flex-1`}
                        />
                        <button
                          onClick={() => setAltFlows((p) => p.filter((f) => f.id !== af.id))}
                          className="p-1 text-[#475569] hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <input
                        value={af.trigger}
                        onChange={(e) => updateAltFlow(af.id, { trigger: e.target.value })}
                        placeholder="Condición que activa este flujo"
                        className={INPUT_CLASS}
                      />
                      <StepList
                        steps={af.steps}
                        onChange={(steps) => updateAltFlow(af.id, { steps })}
                      />
                    </div>
                  ))}
                  {altFlows.length === 0 && (
                    <p className="text-xs text-[#475569] italic">Sin flujos alternativos definidos.</p>
                  )}
                </div>
              </div>
            </>
          )}

          {tab === 'extensions' && (
            <Field label="Extension Points">
              <div className="space-y-1.5">
                {extensionPoints.map((ep, i) => (
                  <div key={i} className="flex items-center gap-2 group">
                    <input
                      value={ep}
                      onChange={(e) => setExtensionPoints((p) => p.map((v, j) => (j === i ? e.target.value : v)))}
                      placeholder={`Extension point ${i + 1}`}
                      className={`${INPUT_CLASS} flex-1`}
                    />
                    <button
                      onClick={() => setExtensionPoints((p) => p.filter((_, j) => j !== i))}
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#475569] hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setExtensionPoints((p) => [...p, ''])}
                  className="flex items-center gap-1 text-xs text-[#7C83FF] hover:text-[#9499ff] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar extension point
                </button>
              </div>
            </Field>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-[#2a3358] shrink-0">
          <button
            onClick={closeModals}
            className="px-4 py-2 text-sm font-medium text-[#cbd5e1] bg-[#1e2738] hover:bg-[#2a3358] rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-[#7C83FF] hover:bg-[#6366f1] rounded-lg transition-colors"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ─── Small helpers ────────────────────────────────────────────────────────────

const LABEL_CLASS = 'block text-xs font-semibold uppercase tracking-wide text-[#60a5fa] mb-1.5';
const INPUT_CLASS = 'w-full px-2.5 py-1.5 bg-[#0f1419] border border-[#2a3358] rounded text-[#e2e8f0] text-sm placeholder-[#374151] focus:outline-none focus:border-[#7C83FF]';
const TEXTAREA_CLASS = `${INPUT_CLASS} resize-none leading-relaxed`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      {children}
    </div>
  );
}

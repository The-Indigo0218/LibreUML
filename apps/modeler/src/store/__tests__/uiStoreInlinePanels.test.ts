import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from '../uiStore';

/**
 * The inline property panels are mutually exclusive: opening one must clear every
 * other inline panel id (and any open modal). This guards the sequence-diagram
 * panels (message/fragment/state-invariant/interaction-use/gate) added alongside
 * the existing class/edge/use-case/domain/actor panels.
 */

const PANEL_IDS = [
  'inlineEdgePanelId',
  'inlineClassPanelId',
  'inlineUseCasePanelId',
  'inlineDomainPanelId',
  'inlineActorPanelId',
  'inlineMessagePanelId',
  'inlineFragmentPanelId',
  'inlineStateInvariantPanelId',
  'inlineInteractionUsePanelId',
  'inlineGatePanelId',
] as const;

type PanelId = (typeof PANEL_IDS)[number];

const OPENERS: Record<PanelId, keyof ReturnType<typeof useUiStore.getState>> = {
  inlineEdgePanelId: 'openInlineEdgePanel',
  inlineClassPanelId: 'openInlineClassPanel',
  inlineUseCasePanelId: 'openInlineUseCasePanel',
  inlineDomainPanelId: 'openInlineDomainPanel',
  inlineActorPanelId: 'openInlineActorPanel',
  inlineMessagePanelId: 'openInlineMessagePanel',
  inlineFragmentPanelId: 'openInlineFragmentPanel',
  inlineStateInvariantPanelId: 'openInlineStateInvariantPanel',
  inlineInteractionUsePanelId: 'openInlineInteractionUsePanel',
  inlineGatePanelId: 'openInlineGatePanel',
};

function openPanelFor(id: PanelId) {
  (useUiStore.getState()[OPENERS[id]] as (x: string) => void)(`el-${id}`);
}

describe('uiStore — inline panel mutual exclusion', () => {
  beforeEach(() => {
    PANEL_IDS.forEach((id) => useUiStore.setState({ [id]: null }));
    useUiStore.setState({ activeModal: null, editingId: null });
  });

  it.each(PANEL_IDS)('opening %s clears all other inline panels', (active) => {
    // Seed every panel as if open, plus a modal.
    PANEL_IDS.forEach((id) => useUiStore.setState({ [id]: 'stale' }));
    useUiStore.setState({ activeModal: 'message-props', editingId: 'x' });

    openPanelFor(active);

    const state = useUiStore.getState();
    expect(state[active]).toBe(`el-${active}`);
    for (const other of PANEL_IDS) {
      if (other !== active) expect(state[other]).toBeNull();
    }
    expect(state.activeModal).toBeNull();
    expect(state.editingId).toBeNull();
  });

  it('opening a sequence panel then a class panel leaves only the class panel', () => {
    openPanelFor('inlineMessagePanelId');
    openPanelFor('inlineClassPanelId');
    const state = useUiStore.getState();
    expect(state.inlineClassPanelId).toBe('el-inlineClassPanelId');
    expect(state.inlineMessagePanelId).toBeNull();
  });
});

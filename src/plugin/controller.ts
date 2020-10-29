import { Restorer } from './Restorer';
import { Switcher } from './Switcher';

figma.showUI(__html__, {
  width: 440,
  height: 400,
});

figma.ui.onmessage = async (msg: { type: MessageType; [key: string]: any }) => {
  console.log(msg);

  switch (msg.type) {
    case 'SWITCH':
      switchComponents(msg.data.pairs, msg.data.components);
      break;
    case 'FOCUS':
      focusNode(msg.nodeId);
      break;
    case 'RESTORE':
      restoreChanges();
      break;
    default:
      break;
  }
};

let twoLastSelected = [];
let prevSelection = [];

figma.on('selectionchange', () => {
  const currSelection = figma.currentPage.selection;
  const diff = currSelection.filter((node) => !prevSelection.find((oldNode) => oldNode.id === node.id));

  prevSelection = [...currSelection];

  if (diff.length) {
    twoLastSelected.push(diff[0]);
    if (twoLastSelected.length > 2) {
      twoLastSelected.shift();
    }
  }
});

async function switchComponents(pairs, components) {
  const frame = figma.currentPage.selection[0];

  if (!frame || frame.type !== 'FRAME') {
    figma.notify('Выделите фрейм');
    return;
  }

  const switcher = new Switcher(frame, pairs, components);

  const results = await switcher.switch();

  figma.ui.postMessage({
    type: 'DONE',
    message: results,
  });
}

function focusNode(nodeId: string) {
  const node = figma.getNodeById(nodeId);

  figma.viewport.scrollAndZoomIntoView([node]);
  figma.currentPage.selection = [node as InstanceNode];
}

function restoreChanges() {
  if (twoLastSelected.length === 2) {
    try {
      const restorer = new Restorer(twoLastSelected[0] as InstanceNode, twoLastSelected[1] as InstanceNode);
      restorer.restore();
    } catch (e) {
      console.error(e);
    }
  }
}

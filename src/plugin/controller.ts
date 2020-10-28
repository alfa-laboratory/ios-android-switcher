import { Switcher } from './Switcher';

figma.showUI(__html__, {
  width: 480,
  height: 300,
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
    default:
      break;
  }
};

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

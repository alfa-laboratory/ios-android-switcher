const STOP_NODE_TYPES = ['BOOLEAN_OPERATION'];
const PRESERVED_PROPERTIES = ['characters', 'textStyleId', 'fillStyleId'];

const WIDTHS = {
  ANDROID: 360,
  IOS: 375,
};

const HEIGHTS = {
  ANDROID: 740,
  IOS: 812,
};

figma.showUI(__html__, {
  width: 240,
  height: 120,
});

figma.ui.onmessage = async (msg: { type: MessageType; [key: string]: any }) => {
  switch (msg.type) {
    case 'SWITCH':
      const { pairs, components } = msg.data;

      const clone = cloneFrame(figma.currentPage.selection[0]);
      if (!clone) return false;

      await switchPlatform(clone, pairs, components);
      break;
    default:
      break;
  }
};

async function switchPlatform(node, pairs, components) {
  const notFound = [];
  let error;

  try {
    const platform = getFramePlatform(node);

    switchLayoutSize(node, platform);

    await travelAsync(node, async (node) => {
      if (node.type === 'INSTANCE') {
        const replaced = await replaceInstance(node, platform, pairs, components);

        if (!replaced) {
          console.warn('Пара не найдена');
          notFound.push(node);
        }

        console.log('-------');

        return false;
      }

      if (node.type === 'TEXT') {
        const replaced = await replaceTextStyle(node, platform, pairs, components);

        if (!replaced) {
          console.warn('Пара не найдена');
          notFound.push(node);
        }

        console.log('-------');
      }
    });
  } catch (e) {
    error = e.message;
  }

  figma.ui.postMessage({
    type: 'DONE',
    message: {
      notFound: notFound.map((node: SceneNode) => node.name),
      error,
    },
  });
}

async function replaceInstance(node: InstanceNode, platform: PLATFORM, pairs, components) {
  const master = node.masterComponent;
  const masterName = `${platform}|${master.name}`;
  const pairName = pairs[masterName];
  const pair = components[pairName];

  console.log('Нашли инстанс', masterName);

  if (pair) {
    console.log('Будет заменен на', pairName);

    const pairComponent = await figma.importComponentByKeyAsync(pair.key);
    const childrenMeta = parseChildrenMeta(node);
    console.log(parseChildrenMeta(node));

    node.masterComponent = pairComponent;

    await restoreMeta(node, childrenMeta);

    return true;
  }
}

async function replaceTextStyle(node: TextNode, platform: PLATFORM, pairs, components) {
  const textStyle = figma.getStyleById(node.textStyleId as string);
  if (textStyle) {
    const textStyleName = `${platform}|${textStyle.name}`;
    const pairName = pairs[textStyleName];
    const pair = components[pairName];

    console.log('Нашли тестовую ноду', textStyleName);

    if (pair) {
      console.log('Будет заменена на', pairName);

      const pairStyle = await figma.importStyleByKeyAsync(pair.key);

      node.textStyleId = pairStyle.id;

      return true;
    }
  }
}

function getVisibleNodes(root: InstanceNode): TextNode[] {
  const visible = (node) => {
    if (node.visible && node.parent && node.parent !== root) return visible(node.parent);
    return node.visible;
  };

  return root.findAll(visible) as TextNode[];
}

function findMasterChild<T extends SceneNode>(master: ComponentNode, childNode: T): T {
  return master.findOne((masterNode) => {
    return masterNode.id.split(';').pop() === childNode.id.split(';').pop();
  }) as T;
}

function parseChildrenMeta(component: InstanceNode): ChildNodeMeta[] {
  const meta = [];

  travel(component, (node) => {
    if (!node.visible) return false;

    const nodeInComponentMaster = findMasterChild(component.masterComponent, node);
    const overrides = {} as any;

    PRESERVED_PROPERTIES.forEach((prop) => {
      if (nodeInComponentMaster && node[prop] !== nodeInComponentMaster[prop]) {
        overrides[prop] = node[prop];
      }
    });

    if (node.type === 'INSTANCE') {
      const nodeInComponentMaster = findMasterChild(component.masterComponent, node);
      const nodeMaster = node.masterComponent;
      // Находим изменения в дочерних компонентах, например измененные иконки
      if (nodeInComponentMaster && nodeMaster.id !== nodeInComponentMaster.masterComponent.id) {
        overrides.masterComponent = nodeMaster;
      }
    }

    if (Object.keys(overrides).length > 0) {
      meta.push({
        name: node.name,
        type: node.type,
        position: getRelativePosition(node, component),
        overrides,
      });
    }
  });

  return meta;
}

function getRelativePosition(node: SceneNode, root: SceneNode) {
  let x = node.x;
  let y = node.y;
  let curr = node as TextNode;
  while (true) {
    if (curr.parent !== root) {
      curr = curr.parent as TextNode;
      x += curr.x;
      y += curr.y;
    } else {
      break;
    }
  }

  return { x, y };
}

function distance(pos, pos2) {
  return Math.sqrt(Math.pow(pos.x - pos2.x, 2) + Math.pow(pos.y - pos2.y, 2));
}

function findNearestComponent(pos, components) {
  if (components.length === 0) return null;
  return components.reduce((a, b) => (distance(pos, a.position) < distance(pos, b.position) ? a : b));
}

async function restoreMeta(component: InstanceNode, childrenMeta: ChildNodeMeta[]) {
  for (let node of component.findAll()) {
    if (childrenMeta.length === 0) break;
    if (!node.visible) continue;

    const pos = getRelativePosition(node, component);
    const nearest = findNearestComponent(
      pos,
      childrenMeta.filter((m) => m.type === node.type)
    );

    if (!nearest) continue;

    console.log(node, node.name, pos, nearest.position, nearest);

    try {
      childrenMeta = childrenMeta.filter((node) => node !== nearest);

      if (node.type === 'TEXT' && nearest.overrides.characters) {
        await figma.loadFontAsync(node.fontName as FontName);
        console.log(`Восстановлен текст для ${node.name}: ${nearest.overrides.characters}`);
      }

      if (node.type === 'TEXT') {
        Object.keys(nearest.overrides).forEach((prop) => {
          node[prop] = nearest.overrides[prop];
        });
      }
    } catch (e) {
      console.log(e);
    }
  }
}

function cloneFrame(node: SceneNode): FrameNode {
  if (node.type !== 'FRAME') {
    figma.notify('Выделите фрейм');
    return;
  }

  const clone = node.clone();
  clone.x += clone.width + 20;

  return clone;
}

function getFramePlatform(frame: FrameNode): PLATFORM {
  if (frame.width === WIDTHS['IOS']) return 'IOS';
  if (frame.width === WIDTHS['ANDROID']) return 'ANDROID';
}

function switchLayoutSize(frame: FrameNode, platform: PLATFORM) {
  if (platform === 'IOS') frame.resize(WIDTHS['ANDROID'], HEIGHTS['ANDROID']);
  if (platform === 'ANDROID') frame.resize(WIDTHS['IOS'], HEIGHTS['IOS']);
}

async function travel(root: SceneNode, callback: (node: SceneNode) => false | void) {
  const callbackResult = callback(root);

  const stopTravel = callbackResult === false || STOP_NODE_TYPES.some((type) => root.type === type);

  if (!stopTravel && 'children' in root) {
    root.children.forEach((child) => travel(child, callback));
  }
}

async function travelAsync(root: SceneNode, callback: (node: SceneNode) => Promise<false | void>) {
  const callbackResult = await callback(root);

  const stopTravel = callbackResult === false || STOP_NODE_TYPES.some((type) => root.type === type);

  if (!stopTravel && 'children' in root) {
    for (let child of root.children) {
      await travelAsync(child, callback);
    }
  }
}

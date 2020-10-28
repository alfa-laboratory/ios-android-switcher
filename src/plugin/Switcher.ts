const STOP_NODE_TYPES = ['BOOLEAN_OPERATION', 'RECTANGLE'];
const PRESERVED_PROPERTIES = ['characters', 'textStyleId', 'fillStyleId'];

const WIDTHS = {
  ANDROID: 360,
  IOS: 375,
};

const HEIGHTS = {
  ANDROID: 740,
  IOS: 812,
};

export class Switcher {
  platform: 'IOS' | 'ANDROID';

  constructor(
    public root: FrameNode,
    public pairs: { [key: string]: string },
    public components: { [key: string]: { key: string } }
  ) {
    this.platform = this.getFramePlatform();
    this.root = this.cloneFrame(root);
  }

  async switch() {
    this.switchLayoutSize();

    return await this.switchInstances();
  }

  private async switchInstances() {
    const results = [];

    await travelAsync(this.root, async (node) => {
      if (node.type === 'FRAME') return;
      if (node.type !== 'INSTANCE') return;

      results.push(await this.switchInstance(node));

      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      return false;
    });

    return results;
  }

  /**
   * Заменяет инстанс на соответствующий компонент другой платформы
   */
  private async switchInstance(instance: InstanceNode) {
    const master = instance.masterComponent;
    const masterName = `${this.platform}|${master.name}`;
    const pairName = this.pairs[masterName];
    const pair = this.components[pairName];

    if (!pairName || !pair) {
      return {
        id: instance.id,
        name: instance.name,
        result: 'NOT_IN_PAIRS',
      };
    }

    const pairComponent = await figma.importComponentByKeyAsync(pair.key);

    instance.masterComponent = pairComponent;

    // const changes = this.getChanges(instance, instance.masterComponent);

    // console.log(changes);

    // const instanceStructure = JSON.stringify(this.getComponentStructure(instance));
    // const pairStructure = JSON.stringify(this.getComponentStructure(pairComponent));

    // if (instanceStructure === pairStructure) {
    //   instance.masterComponent = pairComponent;
    //   await new Promise((resolve) => {
    //     setTimeout(() => {
    //       this.restoreChanges(instance, changes);
    //       resolve();
    //     }, 100);
    //   });

    //   return {
    //     id: instance.id,
    //     name: instance.name,
    //     result: 'SUCCESS',
    //   };
    // } else {
    //   console.error('Структуры компонентов различаются', {
    //     instanceStructure,
    //     pairStructure,
    //   });

    //   return {
    //     id: instance.id,
    //     name: instance.name,
    //     result: 'DIFFERENT_STRUCTURES',
    //   };
    // }
  }

  private getComponentStructure(component: InstanceNode | ComponentNode) {
    const maxDepth = 3;

    const travel = (node, depth = 0) => {
      const nodeStructure = [node.type];

      if (depth < maxDepth) {
        if ('children' in node && node.children.length) {
          const children = [];

          node.children.forEach((child) => {
            children.push(travel(child, depth + 1));
          });

          nodeStructure.push(children);
        }
      }

      return nodeStructure;
    };

    return travel(component)[1];
  }

  private getChanges(instance: InstanceNode, master: ComponentNode): Array<[string, any]> {
    const props = [
      'layoutAlign',
      'fillStyleId',
      'fills',
      'textStyleId',
      'stokeStyleId',
      'characters',
      'visible',
      'width',
      'height',
    ];

    const maxDepth = 3;

    const travel = (instanceChild, masterChild, depth = 0) => {
      let nodeChanges = {};

      props.forEach((prop) => {
        const instanceProp = JSON.stringify(instanceChild[prop]);
        const masterProp = JSON.stringify(masterChild[prop]);

        if (instanceProp !== masterProp) {
          nodeChanges[prop] = JSON.parse(instanceProp);
        }
      });

      const result = [instanceChild.name, nodeChanges];

      if (depth < maxDepth) {
        if ('children' in instanceChild && instanceChild.children.length) {
          const children = [];

          instanceChild.children.forEach((child, i) => {
            children.push(travel(child, masterChild.children[i], depth + 1));
          });

          result.push(children);
        }
      }

      return result;
    };

    return travel(instance, master);
  }

  private restoreChanges(node: InstanceNode, changes: Array<[string, any]>) {
    const applyProps = (node, props) => {
      Object.entries(props).forEach(([prop, value]) => {
        if (prop === 'characters') {
          figma.loadFontAsync(node.fontName as FontName).then(() => {
            node[prop] = value;
          });
        } else if (prop === 'width') {
          node.resize(value, node.height);
        } else if (prop === 'height') {
          node.resize(node.width, value);
        } else {
          node[prop] = value;
        }
      });
    };

    const travel = (node, nodeChanges) => {
      try {
        applyProps(node, nodeChanges[1]);

        if (nodeChanges[2] && 'children' in node && node.children.length) {
          node.children.forEach((child, i) => {
            travel(child, nodeChanges[2][i]);
          });
        }
      } catch (e) {
        console.log(e, node.name, nodeChanges);
      }
    };

    travel(node, changes);
  }

  /**
   * Возвращает копию фрейма и располагает ее справа от оригинала
   */
  private cloneFrame(frame: FrameNode): FrameNode {
    const clone = frame.clone();
    clone.x += clone.width + 20;

    return clone;
  }

  /**
   * Меняет размеры макета под новую платформу
   */
  private switchLayoutSize() {
    const { height } = this.root;

    const oldWidth = this.root.width;

    if (this.platform === 'IOS') {
      this.root.resize(WIDTHS['ANDROID'], height === HEIGHTS['IOS'] ? HEIGHTS['ANDROID'] : height);
    }
    if (this.platform === 'ANDROID') {
      this.root.resize(WIDTHS['IOS'], height === HEIGHTS['ANDROID'] ? HEIGHTS['IOS'] : height);
    }

    /**
     * Проходимся по всем фреймам.
     * Если фрейм был во всю ширину старого макета, то меняем его ширину на соответствующую новую
     */
    travel(this.root, (node) => {
      if (node.type === 'FRAME') {
        if (node.width === oldWidth) node.resize(WIDTHS[this.platform === 'IOS' ? 'ANDROID' : 'IOS'], node.height);
      }
    });
  }

  private getFramePlatform(): PLATFORM {
    let IOSKeys = [];
    let AndroidKeys = [];
    let platform;

    Object.keys(this.components).forEach((name) => {
      if (name.includes('IOS')) IOSKeys.push(this.components[name].key);
      if (name.includes('ANDROID')) AndroidKeys.push(this.components[name].key);
    });

    travel(this.root, (node) => {
      if (node.type === 'INSTANCE') {
        if (IOSKeys.includes(node.masterComponent.key)) platform = 'IOS';
        if (AndroidKeys.includes(node.masterComponent.key)) platform = 'ANDROID';
        return false;
      }
    });

    if (!platform) {
      if ([414, 375].includes(this.root.width)) platform = 'IOS';
      if (this.root.width === WIDTHS['ANDROID']) platform = 'ANDROID';
    }

    return platform;
  }
}

function travel(root: SceneNode, callback: (node: SceneNode) => false | void) {
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

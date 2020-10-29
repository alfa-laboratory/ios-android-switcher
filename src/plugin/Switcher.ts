import { travel, travelAsync } from './utils';

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

    try {
      const pairComponent = await figma.importComponentByKeyAsync(pair.key);
      instance.masterComponent = pairComponent;
      return {
        id: instance.id,
        name: instance.name,
        result: 'SUCCESS',
      };
    } catch (e) {
      return {
        id: instance.id,
        name: instance.name,
        result: 'IMPORT_ERROR',
      };
    }
  }

  /**
   * Возвращает копию фрейма и располагает ее справа от оригинала
   */
  private cloneFrame(frame: FrameNode): FrameNode {
    const clone = frame.clone();
    clone.x += clone.width + 20;

    // TODO: написать нормально
    if (this.platform === 'IOS') {
      if (/\bios\b/i.test(clone.name)) {
        clone.name = clone.name.replace(/\bios\b/i, 'ANDROID');
      } else {
        clone.name = `ANDROID | ${clone.name}`;
      }
    } else {
      if (/\bandroid\b/i.test(clone.name)) {
        clone.name = clone.name.replace(/\bandroid\b/i, 'IOS');
      } else {
        clone.name = `IOS | ${clone.name}`;
      }
    }

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

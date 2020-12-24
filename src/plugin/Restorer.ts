import { travel } from './utils';

export class Restorer {
  constructor(public node: InstanceNode, public reference: InstanceNode) {}

  restore() {
    const props = ['layoutAlign', 'fillStyleId', 'fills', 'textStyleId', 'stokeStyleId', 'characters', 'visible'];

    const structuresEqual = this.compareStructures(this.node, this.reference);

    console.log(`Структура ${structuresEqual ? '' : 'не'} совпадает`);

    if (structuresEqual) {
      const travel = (refChild: ComponentNode, refMasterChild: ComponentNode, nodeChild: ComponentNode = null) => {
        let nodeChanges = {};

        props.forEach((prop) => {
          const instanceProp = JSON.stringify(refChild[prop]);
          const masterProp = JSON.stringify((refMasterChild || {})[prop]);

          if (instanceProp !== masterProp) {
            nodeChanges[prop] = JSON.parse(instanceProp);
          }
        });

        if (Object.keys(nodeChanges).length) {
          this.applyProps(nodeChild, nodeChanges);
          console.log(nodeChild.name, nodeChanges);
        }

        if (refChild.name === 'Icon') return;

        if ('children' in refChild && refChild.children.length) {
          refChild.children.forEach((child, i) => {
            travel(
              child as any,
              refMasterChild ? (refMasterChild as any).children[i] : null,
              structuresEqual ? (nodeChild as any).children[i] : null
            );
          });
        }
      };

      try {
        travel(this.reference as any, this.reference.masterComponent, this.node as any);
      } catch (e) {
        console.log(e);
      }
    } else {
      const nodeChildren = this.findAll(this.node);
      const refChildren = this.findAll(this.reference);

      Object.entries(refChildren).forEach(([refChildName, refChild]) => {
        if (Array.isArray(refChild)) {
          console.error(`В референсном компоненте найдено несколько элементов с именем ${refChildName}`);
          return;
        }
        const node = nodeChildren[refChildName];

        if (!node) {
          console.error(`Элемент с именем ${refChildName} не найден в парном компоненте`);
          return;
        }

        if (Array.isArray(node)) {
          console.error(`Найдено несколько элементов с именем ${refChildName}`);
          return;
        }

        let nodeChanges = {};

        const refMasterChild =
          refChildName === '__root__'
            ? this.reference.masterComponent
            : this.reference.masterComponent.findOne((n) => n.name === refChildName);

        if (!refMasterChild) {
          console.error(`Элемент с именем ${refChildName} не найден в мастере`);
          return;
        }

        props.forEach((prop) => {
          const instanceProp = JSON.stringify(refChild[prop]);
          const masterProp = JSON.stringify(refMasterChild[prop]);

          if (instanceProp !== masterProp) {
            nodeChanges[prop] = JSON.parse(instanceProp);
          }
        });

        if (Object.keys(nodeChanges).length) {
          this.applyProps(node, nodeChanges);
          console.log(node.name, nodeChanges);
        }
      });
    }
  }

  private applyProps(node, props) {
    Object.entries(props).forEach(([prop, value]) => {
      if (prop === 'characters') {
        figma.loadFontAsync(node.fontName as FontName).then(() => {
          node[prop] = value;
        });
      } else {
        node[prop] = value;
      }
    });
  }

  private getComponentStructure(component: SceneNode) {
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

  private compareStructures(firstNode: SceneNode, secondNode: SceneNode) {
    return (
      JSON.stringify(this.getComponentStructure(firstNode)) === JSON.stringify(this.getComponentStructure(secondNode))
    );
  }

  private findAll(node: SceneNode) {
    const acc: Record<string, SceneNode | SceneNode[]> = {};

    travel(node, (child) => {
      const name = child === node ? '__root__' : child.name;

      if (acc[name]) {
        acc[name] = [].concat(acc[name], child);
      } else {
        acc[name] = child;
      }

      if (name === 'Icon') return false;
    });

    return acc;
  }
}

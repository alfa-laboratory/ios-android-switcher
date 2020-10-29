const STOP_NODE_TYPES = ['BOOLEAN_OPERATION', 'RECTANGLE'];

export function travel(root: SceneNode, callback: (node: SceneNode) => false | void) {
  const callbackResult = callback(root);

  const stopTravel = callbackResult === false || STOP_NODE_TYPES.some((type) => root.type === type);

  if (!stopTravel && 'children' in root) {
    root.children.forEach((child) => travel(child, callback));
  }
}

export async function travelAsync(root: SceneNode, callback: (node: SceneNode) => Promise<false | void>) {
  const callbackResult = await callback(root);

  const stopTravel = callbackResult === false || STOP_NODE_TYPES.some((type) => root.type === type);

  if (!stopTravel && 'children' in root) {
    for (let child of root.children) {
      await travelAsync(child, callback);
    }
  }
}

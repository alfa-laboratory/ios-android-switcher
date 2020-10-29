type PLATFORM = 'IOS' | 'ANDROID';

type MessageType = 'SWITCH' | 'FOCUS' | 'NOT_FOUND' | 'DONE' | 'RESTORE';

type Position = {
  x: number;
  y: number;
};

type ChildNodeMeta = {
  name: string;
  parentName: string;
  masterName: string;
  type: string;
  position: Position;
  overrides: {
    [key: string]: string;
    masterComponent?: ComponentNode;
  };
};
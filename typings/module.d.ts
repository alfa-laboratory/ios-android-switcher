type PLATFORM = 'IOS' | 'ANDROID';

type MessageType = 'SWITCH' | 'PARSE' | 'NOT_FOUND' | 'DONE';

type Position = {
  x: number;
  y: number;
};

type ChildNodeMeta = {
  name: string;
  type: string;
  position: Position;
  overrides: {
    [key: string]: string;
  };
};

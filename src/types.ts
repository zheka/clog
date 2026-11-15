export type Kind = 'bouldering' | 'route' | 'kilterboard';
export const KINDS: Kind[] = ['bouldering', 'route', 'kilterboard'];

export type Category = 'success' | 'failure' | 'skip';

export interface Attempt {
  id: string;
  loggedAt: string; // ISO timestamp
  kind: Kind;
  location: string;
  grade: string;
  outcome: string;
  boardAngle?: number; // kilterboard only
}

export interface Outcome {
  name: string;
  category: Category;
}

// Something on the road, across laneSpan lanes from lane. y is the top edge of its hit box in
// screen pixels and height the box's length; id ties it to a sprite.
export interface RoadItem<Kind extends string = string> {
  height: number;
  id: number;
  kind: Kind;
  lane: number;
  laneSpan: number;
  y: number;
}

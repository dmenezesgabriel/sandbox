import { Player } from "@remotion/player";
import { Video } from "./video";
import Content from "./content.md?raw";

export function App() {
  return (
    <div>
      <h1>hello</h1>
      <Player
        component={Video}
        durationInFrames={300}
        fps={30}
        compositionWidth={1280}
        compositionHeight={720}
        controls
        inputProps={{
          markdown: Content,
        }}
      />
    </div>
  );
}

import { memo } from 'react'
import "../css/background.css"

function Background() {
  return (
    <>
      <div id="hud-grid"></div>
      <span className="orb orb-a"></span>
      <span className="orb orb-b"></span>
      <span className="orb orb-c"></span>
    </>
  ) 
}

export default memo(Background)

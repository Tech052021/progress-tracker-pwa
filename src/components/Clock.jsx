import React, { useState, useEffect } from "react";

function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeString = time.toLocaleTimeString();
  const dayString = time.toLocaleDateString(undefined, { weekday: 'long' });
  const dateString = time.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="clock" aria-live="polite">
      <div className="clock-time">{timeString}</div>
      <div className="clock-date">{dayString} · {dateString}</div>
    </div>
  );
}

export default Clock;

import { useEffect, useMemo, useState } from 'react';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const DEFAULT_SIZING = {
  submodalMaxWidth: 460,
  submodalMaxHeight: 520,
  plannerMaxWidth: 720,
  plannerMaxHeight: 680
};

export default function useLayeredModalSizing(parentRef, isActive) {
  const [layerSizing, setLayerSizing] = useState(DEFAULT_SIZING);

  useEffect(() => {
    const recalcLayerSizing = () => {
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const modalRect = parentRef?.current?.getBoundingClientRect();

      const parentW = modalRect?.width || Math.min(980, viewportW - 40);
      const parentH = modalRect?.height || Math.min(Math.round(viewportH * 0.9), viewportH - 40);

      const insetX = Math.max(16, Math.round(parentW * 0.06));
      const insetY = Math.max(16, Math.round(parentH * 0.08));

      const plannerMaxWidth = clamp(parentW - insetX * 2, 540, viewportW - 32);
      const plannerMaxHeight = clamp(parentH - insetY * 2, 360, viewportH - 32);

      const submodalMaxWidth = clamp(Math.min(parentW - insetX * 3, 520), 360, viewportW - 32);
      const submodalMaxHeight = clamp(parentH - insetY * 3, 240, viewportH - 32);

      setLayerSizing({
        submodalMaxWidth,
        submodalMaxHeight,
        plannerMaxWidth,
        plannerMaxHeight
      });
    };

    recalcLayerSizing();
    window.addEventListener('resize', recalcLayerSizing);

    let observer = null;
    if (typeof ResizeObserver !== 'undefined' && parentRef?.current) {
      observer = new ResizeObserver(recalcLayerSizing);
      observer.observe(parentRef.current);
    }

    return () => {
      window.removeEventListener('resize', recalcLayerSizing);
      if (observer) observer.disconnect();
    };
  }, [isActive, parentRef]);

  const plannerSubmodalStyle = useMemo(() => ({
    maxWidth: `${Math.round(layerSizing.plannerMaxWidth)}px`,
    maxHeight: `${Math.round(layerSizing.plannerMaxHeight)}px`
  }), [layerSizing.plannerMaxHeight, layerSizing.plannerMaxWidth]);

  const addCategorySubmodalStyle = useMemo(() => ({
    maxWidth: `${Math.round(layerSizing.submodalMaxWidth)}px`,
    maxHeight: `${Math.round(layerSizing.submodalMaxHeight)}px`
  }), [layerSizing.submodalMaxHeight, layerSizing.submodalMaxWidth]);

  return {
    plannerSubmodalStyle,
    addCategorySubmodalStyle
  };
}

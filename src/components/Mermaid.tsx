import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: true,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'Inter',
});

interface MermaidProps {
  chart: string;
}

const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const renderChart = async () => {
      if (ref.current && chart) {
        try {
          const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
          const { svg } = await mermaid.render(id, chart);
          ref.current.innerHTML = svg;
        } catch (error) {
          console.error('Mermaid render error:', error);
          ref.current.innerHTML = '<p class="text-red-500 text-xs">Failed to render diagram. Check syntax.</p>';
        }
      }
    };

    renderChart();
  }, [chart]);

  return (
    <div className="mermaid-container flex justify-center bg-zinc-900/50 p-6 rounded-xl overflow-auto border border-white/10" ref={ref} />
  );
};

export default Mermaid;

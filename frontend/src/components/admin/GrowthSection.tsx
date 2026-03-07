import * as d3 from "d3";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { GrowthPoint } from "../../types/api";

function GrowthChart({ points }: { points: GrowthPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || points.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 16, right: 16, bottom: 28, left: 44 };
    const width = svgRef.current.clientWidth;
    const height = 200;

    const data = points.map((p) => ({ date: new Date(p.date), total: p.total }));

    const x = d3
      .scaleTime()
      .domain(d3.extent(data, (d) => d.date) as [Date, Date])
      .range([margin.left, width - margin.right]);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.total) ?? 1])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const line = d3
      .line<(typeof data)[0]>()
      .x((d) => x(d.date))
      .y((d) => y(d.total))
      .curve(d3.curveMonotoneX);

    const area = d3
      .area<(typeof data)[0]>()
      .x((d) => x(d.date))
      .y0(height - margin.bottom)
      .y1((d) => y(d.total))
      .curve(d3.curveMonotoneX);

    // Area fill
    svg.append("path").datum(data).attr("fill", "rgba(45, 138, 94, 0.12)").attr("d", area);

    // Line
    svg
      .append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "var(--color-accent)")
      .attr("stroke-width", 2)
      .attr("d", line);

    // X axis
    svg
      .append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(Math.min(data.length, 6))
          .tickFormat(d3.timeFormat("%b %d") as (d: Date | d3.NumberValue) => string),
      )
      .call((g) => g.select(".domain").attr("stroke", "var(--color-border-primary)"))
      .call((g) =>
        g.selectAll(".tick text").attr("fill", "var(--color-text-muted)").attr("font-size", "11"),
      )
      .call((g) => g.selectAll(".tick line").attr("stroke", "var(--color-border-secondary)"));

    // Y axis
    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(4))
      .call((g) => g.select(".domain").attr("stroke", "var(--color-border-primary)"))
      .call((g) =>
        g.selectAll(".tick text").attr("fill", "var(--color-text-muted)").attr("font-size", "11"),
      )
      .call((g) => g.selectAll(".tick line").attr("stroke", "var(--color-border-secondary)"));
  }, [points]);

  return <svg ref={svgRef} className="admin-growth-svg" />;
}

export function GrowthSection({ points }: { points: GrowthPoint[] }) {
  const { t } = useTranslation();

  return (
    <section>
      <div className="admin-section__title">{t("admin.userGrowth")}</div>
      <GrowthChart points={points} />
    </section>
  );
}

// Load the data here
const margin = { top: 20, right: 180, bottom: 60, left: 70 };
const totalWidth = 1100;
const totalHeight = 520;
const width = totalWidth - margin.left - margin.right;
const innerHeight = totalHeight - margin.top - margin.bottom;

d3.csv(
  "data/love_song_categories_for_Billboard_Top_10_hits_1958_2023.csv",
).then((rawData) => {
  const data = rawData.filter((d) => d.love_song_category !== "");
  const songCategories = Array.from(
    new Set(data.map((d) => d.love_song_category)),
  ).sort();
  createViz(data, songCategories);
});
// Create your visualization
function createViz(data, songCategories) {
  let model = {
    data,
    songCategories,
    groupedData: null,
    selectedCategory: "All",
    selectedYears: null,
  };
  model.groupedData = formatDataGroups(data);
  model.selectedYears = d3.extent(model.groupedData, (d) => d.year);

  // DOM
  function initDOM() {}

  const dom = initDOM();
  const viz = initViz(model);

  function initSlider(model) {
    function onYearsSlider(values) {
      update({
          selectedYears: values.split(",").map(Number)
            });
    }

    const dataYearsArray = Array.from(
      model.data.map((d) => Math.floor(+d.top_10_debut_date_as_decimal)),
    );
    const yearsRange = d3.range(
      d3.min(dataYearsArray),
      d3.max(dataYearsArray) + 1,
    );

    return new rSlider({
      target: "#yearsSlider",
      values: yearsRange,
      range: true,
      tooltip: true,
      scale: true,
      labels: false,
      set: [yearsRange[0], yearsRange[yearsRange.length - 1]],
      onChange: onYearsSlider,
    });
  }

  function initLegend(model, viz) {
    const items = d3
      .select(".legend")
      .append("ul")
      .selectAll("li")
      .data(model.songCategories)
      .join("li");
    items
      .append("span")
      .attr("class", "legend-color")
      .style("background-color", (d) => viz.colorScale(d));
    items
      .append("span")
      .attr("class", "legend-label")
      .text((d) => d);
  }

  function initOptions(model) {
  d3.select("#selectSongCategory")
    .selectAll("option")
    .data(["All", ...model.songCategories])
    .join("option")
    .attr("value", d => d)
    .text(d => d);
}

  function formatDataGroups(data) {
    //Use D3 roll-up (group by + aggregate)
    //Parts:
    //data
    //reduceFn --> how to do within each group
    //keyFn --> how to group by

    const rolledUp = d3.rollup(
      data,
      (rows) => rows.length, // reduceFn
      (d) => Math.floor(+d.top_10_debut_date_as_decimal), // keyFn: year
      (d) => d.love_song_category, // keyFn: category
    );
    const years = d3.range(
      d3.min(data, (d) => Math.floor(+d.top_10_debut_date_as_decimal)),
      d3.max(data, (d) => Math.floor(+d.top_10_debut_date_as_decimal)) + 1,
    );
    const groupedArray = years.map((year) => {
      const row = { year, total: 0 };
      const counts = rolledUp.get(year) ?? new Map();
      for (const category of songCategories) {
        const count = counts.get(category) ?? 0;
        row[category] = count;
        row.total += count;
      }
      return row;
    });

    return groupedArray;
  }

  // Viz
  function initViz(model) {
    const svg = d3
      .select("#viz")
      .append("svg")
      .attr("viewBox", `0 0 ${totalWidth} ${totalHeight}`)
      .attr("preserveAspectRatio", "xMidYMid meet");
    svg
      .append("defs")
      .append("clipPath")
      .attr("id", "clip")
      .append("rect")
      .attr("width", width)
      .attr("height", innerHeight);
    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);
    const layersG = g.append("g").attr("clip-path", "url(#clip)");
    const xAxisG = g
      .append("g")
      .attr("transform", `translate(0, ${innerHeight})`);
    const yAxisG = g.append("g");
    const xScale = d3.scaleLinear().range([0, width]);
    const yScale = d3.scaleLinear().range([innerHeight, 0]);
    const colorScale = d3
      .scaleOrdinal()
      .domain(model.songCategories)
      .range([
        "#E76F51",
        "#F4A261",
        "#E9C46A",
        "#2A9D8F",
        "#264653",
        "#9B5DE5",
        "#F15BB5",
      ]);
    const stack = d3
      .stack()
      .keys(model.songCategories)
      .offset(d3.stackOffsetWiggle)
      .order(d3.stackOrderInsideOut);
    const area = d3
      .area()
      .x((d) => xScale(d.data.year))
      .y0((d) => yScale(d[0]))
      .y1((d) => yScale(d[1]))
      .curve(d3.curveBasis);
    g.append("text")
      .attr("x", width / 2)
      .attr("y", innerHeight + 45)
      .attr("text-anchor", "middle")
      .text("Year");
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -45)
      .attr("text-anchor", "middle")
      .text("Number of songs");
      // Vertical line displayed on hover
    const hoverLine = g.append("line")
      .attr("y1", 0)
      .attr("y2", innerHeight)
      .attr("stroke", "#333")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4,4")
      .style("pointer-events", "none")
      .style("display", "none");

    // Invisible rectangle to capture mouse movement
    const hoverArea = g.append("rect")
      .attr("width", width)
      .attr("height", innerHeight)
      .attr("fill", "transparent")
      .style("pointer-events", "all");

    // Tooltip displayed beside the mouse
    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "chart-tooltip")
      .style("position", "fixed")
      .style("display", "none")
      .style("pointer-events", "none")
      .style("background", "white")
      .style("border", "1px solid #ccc")
      .style("border-radius", "6px")
      .style("padding", "10px")
      .style("box-shadow", "0 2px 8px #0002")
      .style("font-size", "13px")
      .style("white-space", "pre-line")
      .style("z-index", "1000");
    return {
      svg,
      g,
      layersG,
      xAxisG,
      yAxisG,
      xScale,
      yScale,
      colorScale,
      stack,
      area,
      hoverLine,
      hoverArea,
      tooltip
    };
  }

  // Update
function update(patch) {
  Object.assign(model, patch);
  view(dom, model, viz);
}

  // View
  function view(dom, model, viz) {
  const {
    layersG, xAxisG, yAxisG,
    xScale, yScale, colorScale, stack, area
  } = viz;

  // 1. Filter by selected year range
  const visibleData = model.groupedData.filter(d =>
    d.year >= model.selectedYears[0] &&
    d.year <= model.selectedYears[1]
  );

  // 2. Choose which categories to display
  const visibleCategories =
    model.selectedCategory === "All"
      ? model.songCategories
      : [model.selectedCategory];

  // 3. Configure the stack
  stack
    .keys(visibleCategories)
    .offset(
      model.selectedCategory === "All"
        ? d3.stackOffsetWiggle
        : d3.stackOffsetNone
    )
    .order(
      model.selectedCategory === "All"
        ? d3.stackOrderInsideOut
        : d3.stackOrderNone
    );

  const series = stack(visibleData);

  // 4. Update the scales
  xScale.domain(model.selectedYears);

  yScale.domain([
    d3.min(series, s => d3.min(s, d => d[0])) ?? 0,
    d3.max(series, s => d3.max(s, d => d[1])) ?? 1
  ]).nice();

  // 5. Create one transition
  const t = d3.transition().duration(650);

  // 6. Animate axes
  xAxisG.transition(t)
    .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));

  yAxisG.transition(t)
    .call(d3.axisLeft(yScale));

  // 7. Update and animate stacked areas
  layersG.selectAll("path.layer")
    .data(series, d => d.key)
    .join(
      enter => enter
        .append("path")
        .attr("class", "layer")
        .attr("fill", d => colorScale(d.key))
        .attr("d", area)
        .style("opacity", 0)
        .call(enter => enter.transition(t)
          .style("opacity", 1)),

      update => update
        .call(update => update.transition(t)
          .attr("d", area)
          .style("opacity", 1)),

      exit => exit
        .call(exit => exit.transition(t)
          .style("opacity", 0)
          .remove())
    );

  // Hide the hover interaction during updates
  if (viz.hoverLine) {
    viz.hoverLine.style("display", "none");
    viz.tooltip.style("display", "none");
  }
  }


  // Events
function initEvents(dom, model, viz) {
  d3.select("#selectSongCategory")
    .on("change", function () {
      update({
        selectedCategory: this.value
      });
    });

  viz.hoverArea
    .on("mousemove", function (event) {

      // 1. Get mouse position inside the chart
      const [mouseX] = d3.pointer(event, viz.g.node());

      // 2. Convert mouse position to a year
      const year = Math.round(viz.xScale.invert(mouseX));

      // 3. Find the data for that year
      const yearData = model.groupedData.find(
        d => d.year === year
      );

      if (!yearData) {
        viz.hoverLine.style("display", "none");
        viz.tooltip.style("display", "none");
        return;
      }

      // 4. Position the vertical line
      const x = viz.xScale(year);

      viz.hoverLine
        .attr("x1", x)
        .attr("x2", x)
        .style("display", null);

      // 5. Choose categories to display
      const categories =
        model.selectedCategory === "All"
          ? model.songCategories
          : [model.selectedCategory];

      // 6. Build tooltip text
      const lines = [
        `Year: ${year}`,
        `Total songs: ${yearData.total}`
      ];

      categories.forEach(category => {
        lines.push(`${category}: ${yearData[category]}`);
      });

      // 7. Display the tooltip
      viz.tooltip
        .text(lines.join("\n"))
        .style("left", `${event.clientX + 15}px`)
        .style("top", `${event.clientY + 15}px`)
        .style("display", "block");
    })

    // Hide tooltip when the mouse leaves the chart
    .on("mouseleave", function () {
      viz.hoverLine.style("display", "none");
      viz.tooltip.style("display", "none");
    });
}

  // Init
  function init(model) {
    initSlider(model);
    initEvents(dom, model, viz);
    initLegend(model, viz);
    initOptions(model);
    view(dom, model, viz);
  }

  init(model);
}

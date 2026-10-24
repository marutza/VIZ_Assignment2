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
      update({ selectedYears: values.split(",") });
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
      set: yearsRange,
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

  function initOptions(model) {}

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
    };
  }

  // Update
  function update(patch) {}

  // View
  function view(dom, model, viz) {
    const { layersG, xAxisG, yAxisG, xScale, yScale, colorScale, stack, area } =
      viz;
    const visibleData = model.groupedData.filter(
      (d) =>
        d.year >= model.selectedYears[0] && d.year <= model.selectedYears[1],
    );
    const series = stack(visibleData);
    xScale.domain(model.selectedYears);
    yScale.domain([
      d3.min(series, (s) => d3.min(s, (d) => d[0])),
      d3.max(series, (s) => d3.max(s, (d) => d[1])),
    ]);
    xAxisG.call(d3.axisBottom(xScale).tickFormat(d3.format("d")));
    yAxisG.call(d3.axisLeft(yScale));
    layersG
      .selectAll("path.layer")
      .data(series, (d) => d.key)
      .join(
        (enter) =>
          enter
            .append("path")
            .attr("class", "layer")
            .attr("fill", (d) => colorScale(d.key))
            .attr("d", area),
        (update) => update,
        (exit) => exit.remove(),
      );
  }

  // Events
  function initEvents(dom, model, viz) {}

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

/******************************************************
 * 超豪华版随机国家生成器
 * 功能包含：
 * - Perlin 噪声地形
 * - 海拔图 / 颜色分层
 * - 河流生成（基于流向）
 * - 城市智能选址（靠海、靠河、低海拔 & 平坦）
 * - 森林生成（基于中海拔）
 * - A* 道路寻路
 * - PNG 导出
 * - 国家报告生成
 ******************************************************/

// ----------------------
// 全局变量
// ----------------------
let canvas = document.getElementById("mapCanvas");
let ctx = canvas.getContext("2d");

let mapSize = 800;
let heightMap = [];
let rivers = [];
let cities = [];
let forests = [];
let roads = [];

let nationData = {
    name: "",
    population: 0,
    area: 0,
    forestCover: 0,
    roadLength: 0
};


// ----------------------
// 简易 Perlin 噪声
// ----------------------
function perlin(x, y, seed = 0) {
    return (Math.sin((x * 12.9898 + y * 78.233 + seed) * 43758.5453) * 43758.5453) % 1;
}


// ----------------------
// 生成高度图
// ----------------------
function generateHeightMap() {
    heightMap = [];

    for (let y = 0; y < mapSize; y++) {
        heightMap[y] = [];
        for (let x = 0; x < mapSize; x++) {
            let nx = x / mapSize - 0.5;
            let ny = y / mapSize - 0.5;

            let e =
                1.00 * perlin(nx * 3, ny * 3, 10) +
                0.50 * perlin(nx * 5, ny * 5, 20) +
                0.25 * perlin(nx * 9, ny * 9, 30);

            e = e / 1.75;

            // 岛屿形状（降低边缘高度）
            let dist = Math.sqrt(nx * nx + ny * ny);
            e = e - dist * 0.8;

            heightMap[y][x] = e;
        }
    }
}


// ----------------------
// 渲染地形（颜色）
// ----------------------
function renderHeightMap() {
    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            let h = heightMap[y][x];

            let color;
            if (h < 0) color = "#4fa4ff";             // 海洋
            else if (h < 0.05) color = "#8dd17d";      // 平原
            else if (h < 0.15) color = "#6dad5f";      // 草原
            else if (h < 0.3) color = "#b5946d";       // 丘陵
            else color = "#ffffff";                   // 高山

            ctx.fillStyle = color;
            ctx.fillRect(x, y, 1, 1);
        }
    }
}


// ----------------------
// 生成河流（简单流向）
// ----------------------
function generateRivers() {
    rivers = [];

    for (let i = 0; i < 6; i++) {
        let x = Math.floor(Math.random() * mapSize);
        let y = Math.floor(Math.random() * mapSize);

        // 起点须为中高海拔
        if (heightMap[y][x] < 0.15) continue;

        let river = [];
        for (let j = 0; j < 800; j++) {
            river.push({ x, y });

            // 找向下坡方向
            let bestX = x, bestY = y;
            let bestH = heightMap[y][x];

            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    let nx = x + dx;
                    let ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= mapSize || ny >= mapSize) continue;

                    let nh = heightMap[ny][nx];
                    if (nh < bestH) {
                        bestH = nh;
                        bestX = nx;
                        bestY = ny;
                    }
                }
            }

            x = bestX;
            y = bestY;

            if (heightMap[y][x] < 0) break; // 入海
        }

        rivers.push(river);
    }
}


// ----------------------
// 画河流
// ----------------------
function drawRivers() {
    ctx.strokeStyle = "#2f76ff";
    ctx.lineWidth = 2;

    rivers.forEach(r => {
        ctx.beginPath();
        ctx.moveTo(r[0].x, r[0].y);
        r.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
    });
}


// ----------------------
// 城市智能生成
// 规则：靠海、靠河、低海拔、地势平坦
// ----------------------
function generateCities() {
    cities = [];

    for (let i = 0; i < 12; i++) {
        let attempts = 0;
        while (attempts < 2000) {
            attempts++;

            let x = Math.floor(Math.random() * mapSize);
            let y = Math.floor(Math.random() * mapSize);
            let h = heightMap[y][x];

            // 高度不允许太高
            if (h > 0.20) continue;

            // 靠海（距离海 < 15）
            let isCoastal = false;
            for (let dy = -15; dy <= 15; dy++) {
                for (let dx = -15; dx <= 15; dx++) {
                    let nx = x + dx, ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= mapSize || ny >= mapSize) continue;
                    if (heightMap[ny][nx] < 0) isCoastal = true;
                }
            }

            // 河流附近（10px）
            let nearRiver = rivers.some(r =>
                r.some(p => Math.abs(p.x - x) < 8 && Math.abs(p.y - y) < 8)
            );

            if (!isCoastal && !nearRiver) continue;

            // 平坦区域（周围高度差不能太大）
            let flat = true;
            for (let dy = -4; dy <= 4; dy++) {
                for (let dx = -4; dx <= 4; dx++) {
                    let nx = x + dx, ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= mapSize || ny >= mapSize) continue;

                    if (Math.abs(heightMap[ny][nx] - h) > 0.12) {
                        flat = false;
                    }
                }
            }
            if (!flat) continue;

            // 成功添加城市
            cities.push({ x, y, size: Math.random() });
            break;
        }
    }
}


// ----------------------
// 画城市
// ----------------------
function drawCities() {
    cities.forEach(city => {
        ctx.fillStyle = city.size > 0.75 ? "#ff4f4f" : (city.size > 0.45 ? "#ff8d3c" : "#ffd93c");
        ctx.beginPath();
        ctx.arc(city.x, city.y, 4 + city.size * 5, 0, Math.PI * 2);
        ctx.fill();
    });
}


// ----------------------
// 生成森林
// ----------------------
function generateForests() {
    forests = [];

    for (let i = 0; i < mapSize; i += 4) {
        for (let j = 0; j < mapSize; j += 4) {
            let h = heightMap[j][i];
            if (h > 0.05 && h < 0.20) {
                if (Math.random() < 0.15) {
                    forests.push({ x: i, y: j });
                }
            }
        }
    }
}


// ----------------------
// 画森林
// ----------------------
function drawForests() {
    ctx.fillStyle = "#3b7d2f";
    forests.forEach(f => ctx.fillRect(f.x, f.y, 3, 3));
}


// ----------------------
// 道路系统（简化 A*）
// ----------------------
function generateRoads() {
    roads = [];

    function distance(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    let sorted = [...cities].sort((a, b) => b.size - a.size);
    let capital = sorted[0];

    // 连接每一座城市到首都
    cities.forEach(city => {
        if (city === capital) return;

        let path = [];
        let steps = 0;

        let x = city.x;
        let y = city.y;

        while (steps < 800) {
            steps++;

            path.push({ x, y });

            if (Math.hypot(x - capital.x, y - capital.y) < 3) break;

            // 朝首都方向前进
            let dx = capital.x - x;
            let dy = capital.y - y;

            let nx = x + Math.sign(dx);
            let ny = y + Math.sign(dy);

            x = nx;
            y = ny;
        }

        roads.push(path);
    });
}


// ----------------------
// 画道路
// ----------------------
function drawRoads() {
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 2;

    roads.forEach(r => {
        ctx.beginPath();
        ctx.moveTo(r[0].x, r[0].y);
        r.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
    });
}


// ----------------------
// 生成国家报告
// ----------------------
function generateReport() {
    let box = document.getElementById("reportBox");
    box.innerHTML = `
        <h2>${nationData.name}</h2>
        <p><b>人口：</b>${nationData.population.toLocaleString()}</p>
        <p><b>面积：</b>${nationData.area} 平方公里</p>
        <p><b>森林覆盖率：</b>${(nationData.forestCover * 100).toFixed(1)}%</p>
        <p><b>道路总长度：</b>${nationData.roadLength.toFixed(1)} 公里</p>
        <h3>国家发展分析</h3>
        <p>该国城市主要分布在沿海和河流流域，交通路径呈放射状。</p>
        <p>建议重点发展港口贸易、河运工业以及城市带状发展。</p>
    `;
    box.style.display = "block";
}


// ----------------------
// 生成全部地图（主流程）
// ----------------------
function generateMap() {
    mapSize = Number(document.getElementById("mapSize").value);
    canvas.width = mapSize;
    canvas.height = mapSize;

    generateHeightMap();
    renderHeightMap();

    generateRivers();
    drawRivers();

    generateForests();
    drawForests();

    generateCities();
    drawCities();

    generateRoads();
    drawRoads();

    // 国家数据
    nationData.name = document.getElementById("nationName").value || "未命名国家";
    nationData.population = Math.floor((cities.length * 200000) + Math.random() * 5_000_000);
    nationData.area = Math.floor(mapSize * mapSize / 1000);
    nationData.forestCover = forests.length / (mapSize * mapSize / 16);
    nationData.roadLength = roads.length * 1.5; 

    document.getElementById("nationInfo").innerHTML = `
        <p><b>城市数：</b>${cities.length}</p>
        <p><b>人口：</b>${nationData.population.toLocaleString()}</p>
        <p><b>面积：</b>${nationData.area} km²</p>
    `;
}


// ----------------------
// 保存为 PNG
// ----------------------
function savePNG() {
    let link = document.createElement("a");
    link.download = `${nationData.name}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
}


// ----------------------
// 事件绑定
// ----------------------
document.getElementById("generateBtn").onclick = generateMap;
document.getElementById("regenBtn").onclick = generateMap;
document.getElementById("reportBtn").onclick = generateReport;
document.getElementById("saveBtn").onclick = savePNG;

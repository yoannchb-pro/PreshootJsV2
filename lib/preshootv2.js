'use strict';

class Preshoot {
    static debug = false;

    constructor(query, parameters = {}, config = {}) {
        if (!query || query.length < 1) throw "Array query not specified !";

        this.query = query;
        this.fn = parameters.fn || function() {};
        this.className = parameters.className || "preshoot";
        this.exitFn = parameters.exitFn || function() {};

        this.config = {
            resetClass: config.resetClass == undefined ? true : config.resetClass,
            mobile: config.mobile == undefined ? true : config.mobile,
            detectWithArea: config.detectWithArea == undefined ? false : config.detectWithArea,
            mouseInterval: config.mouseInterval == undefined ? 23 : config.mouseInterval,
        };

        this.onError = config.onError || function(el, msg) {
            console.warn("Error during executing function ", {
                error: true,
                element: el,
                message: msg
            });
        };
    }

    distance(x, y, xx, yy) {
        const calcX = Math.pow(x - xx, 2);
        const calcY = Math.pow(y - yy, 2);
        return Math.sqrt(calcX + calcY);
    }

    intersects(a, b, c, d, p, q, r, s) {
        var det, gamma, lambda;
        det = (c - a) * (s - q) - (r - p) * (d - b);
        if (det === 0) {
            return false;
        } else {
            lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
            gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
            return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
        }
    }

    static debugMode(preshoot) {
        Preshoot.prototype.debug = false;
        preshoot.debug = true;
    }

    stop() {
        window.removeEventListener('mousemove', this.initPreshoot);
    }

    start() {
        let preshoot = [];
        this.query.forEach((e) => {
            const obt = document.querySelectorAll(e);
            if (obt) obt.forEach((el) => {
                preshoot.push(el);
            });
        });

        const obj = this;

        let mouseLoopCount = 0;
        let backElement = false;

        const lastMouse = {
            x: false,
            y: false
        }

        function initPreshoot(event) {
            //agrandi la marge de calcule
            mouseLoopCount++;
            if (mouseLoopCount < obj.config.mouseInterval) return;
            else mouseLoopCount = 0;

            const touch = event.type == 'touchmove' ? (event.touches[0] || event.changedTouches[0]) : false;
            const x = event.clientX || touch.clientX;
            const y = event.clientY || touch.clientY;

            let min = false;
            let minElement = null;
            let minDist = null;
            let calcLine = false;

            preshoot.forEach((element) => {
                const objY = element.offsetTop + (element.offsetHeight / 2);
                const objX = element.offsetLeft + (element.offsetWidth / 2);
                //const radius = ((element.offsetHeight / 2) + (element.offsetWidth / 2)) / 2;
                const dist = obj.distance(x, y, objX, objY);

                //Detect line intersection
                if (lastMouse['x'] && lastMouse['y']) {
                    const diffX = x - lastMouse['x'];
                    const diffY = y - lastMouse['y'];

                    const coeff = diffY / diffX;

                    const supp = window.innerWidth > window.innerHeight ? window.innerWidth : window.innerHeight;

                    const x2 = supp * diffX;
                    const y2 = coeff * x2;

                    let cond = false;
                    if ((diffX >= 0 && diffY >= 0) || (diffX <= 0 && diffY <= 0)) cond = obj.intersects(x, y, x2, y2,
                        element.offsetLeft + element.offsetWidth, element.offsetTop, element.offsetLeft, element.offsetTop + element.offsetHeight);

                    if ((diffX >= 0 && diffY <= 0) || (diffX <= 0 && diffY >= 0)) cond = obj.intersects(x, y, x2, y2,
                        element.offsetLeft, element.offsetTop, element.offsetLeft + element.offsetWidth, element.offsetTop + element.offsetHeight)


                    if (obj.debug && isFinite(x2) && isFinite(y2)) {
                        let svg = document.querySelector('#debug-preshoot');

                        if (!svg) {
                            const debugEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                            const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');

                            debugEl.id = "debug-preshoot";
                            debugEl.style = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none";

                            l.setAttribute("stroke", "rgb(0, 0, 0)");
                            l.setAttribute("opacity", "0.4");
                            l.setAttribute("stroke-width", "2");
                            l.setAttribute("x1", "0");
                            l.setAttribute("x2", "0");
                            l.setAttribute("y1", "0");
                            l.setAttribute("y2", "0");

                            debugEl.appendChild(l);

                            document.body.appendChild(debugEl);
                        }

                        svg = document.querySelector('#debug-preshoot');
                        const line = svg.querySelector('line');

                        line.x1.baseVal.value = x;
                        line.y1.baseVal.value = y;
                        line.x2.baseVal.value = x2;
                        line.y2.baseVal.value = y2;
                    }

                    if (cond) {
                        if (calcLine && (!min || min > dist)) {
                            min = dist;
                            minDist = dist;
                            calcLine = true;
                            minElement = element;
                        } else if (!calcLine) {
                            min = dist;
                            minDist = dist;
                            calcLine = true;
                            minElement = element;
                        }
                    }
                }

                //Detect by area distance
                if (obj.config.detectWithArea && !calcLine && (!min || min > dist)) {
                    minDist = dist;
                    min = dist;
                    minElement = element;
                }
            });

            //modify element
            if (minElement) {
                const moyEcran = (window.innerWidth + window.innerHeight) / 2;
                const prc = (minDist / moyEcran) * 100;

                try {
                    obj.fn({
                        type: "focus",
                        element: minElement,
                        distance: minDist,
                        pourcentage: prc
                    });
                } catch (e) {
                    obj.onError(minElement, e);
                }

                const className = obj.className;

                minElement.classList.add(className || "preshoot");

                preshoot.forEach((element) => {
                    const className = obj.className;
                    if (element != minElement) element.classList.remove(className || "preshoot");
                });
            } else if (obj.config.resetClass) {
                preshoot.forEach((element) => {
                    element.classList.remove(obj.className || "preshoot");
                });
            }

            if (backElement && backElement != minElement) obj.exitFn({
                type: "exit",
                element: backElement,
            });
            //end

            lastMouse['x'] = x;
            lastMouse['y'] = y;

            backElement = minElement;
        }

        this.initPreshoot = initPreshoot;
        window.addEventListener('mousemove', initPreshoot);
        if (this.config.mobile) window.addEventListener('touchmove', initPreshoot);
    }
}
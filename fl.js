window.onload = function() {
    const canvas = document.getElementById("gameCanvas");
    const context = canvas.getContext("2d");
    
    const gameOverScreen = document.getElementById("gameOverScreen");

    let boardWidth = 360;
    let boardHeight = 640;
    canvas.width = boardWidth;
    canvas.height = boardHeight;

    // Bird
    let birdWidth = 78;
    let birdHeight = 58;
    let birdX = boardWidth / 8;
    let birdY = boardHeight / 2;
    let bird = { x: birdX, y: birdY, width: birdWidth, height: birdHeight };
    // The source image has transparent/empty space around the visible face.
    // Use a smaller box for pipe collisions so near misses remain safe.
    const birdHitboxPadding = { left: 22, right: 22, top: 8, bottom: 8 };
    let birdImg;

    // --- NEW: Load two coin images ---
    let coinArray = [];
    let coinWidth = 38, coinHeight = 38;
    let coin1Img = new Image();
    coin1Img.src = "bird.png";
    let coin2Img = new Image();
    coin2Img.src = "coin2.png";
    let coinSound = new Audio("coin.mp3");

    // Audio Files
    let failSound = new Audio("poo.mp3");
    let music1 = new Audio("kaayal.mp3");
    let music2 = new Audio("music2.mp3");
    music1.onended = () => music2.play();
    music2.onended = () => music1.play();
    music2.onerror = () => {
        music1.onended = () => {
            music1.currentTime = 0;
            music1.play();
        };
    };

    // Pipes & Game State
    let pipeArray = [], pipeWidth = 64, pipeHeight = 512, pipeX = boardWidth;

    // Difficulty starts gently and increases a little with every pipe.
    const startingOpeningSpace = 240;
    const minimumOpeningSpace = 155;
    const gapReductionPerPipe = 5;
    const pipeEdgeMargin = 45;
    let velocityX = -2, velocityY = 0, gravity = 0.4;
    let gameOver = false, score = 0, gameStarted = false;
    let highScore = Number(localStorage.getItem("vvBirdHighScore")) || 0;
    let pipeCount = 0; // --- NEW: Counter to track pipes for alternating coins ---

    birdImg = new Image();
    birdImg.src = "bird.png";
    birdImg.onload = () => requestAnimationFrame(update);

    function update() {
        requestAnimationFrame(update);
        if (gameOver) return;
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Bird
        if (gameStarted) {
            velocityY += gravity;
            bird.y = Math.max(bird.y + velocityY, 0);
        }
        context.drawImage(birdImg, bird.x, bird.y, bird.width, bird.height);

        if (bird.y + bird.height > boardHeight) triggerGameOver();

        // Pipes
        for (let pipe of pipeArray) {
            if (gameStarted) pipe.x += velocityX;
            context.fillStyle = "green";
            context.fillRect(pipe.x, pipe.y, pipe.width, pipe.height);
            if (detectCollision(getBirdHitbox(), pipe)) triggerGameOver();

            // Count each pair once when its top pipe passes the bird.
            if (pipe.isTop && !pipe.passed && pipe.x + pipe.width < bird.x) {
                pipe.passed = true;
                addScore(1);
            }
        }
        
        // Coin Logic
        for (let coin of coinArray) {
            if (gameStarted) {
                coin.x += velocityX;
                coin.angle += 0.1;
            }

            if (!coin.collected) {
                context.save();
                context.translate(coin.x + coin.width / 2, coin.y + coin.height / 2);
                context.scale(Math.cos(coin.angle), 1);
                // --- NEW: Draw the specific image stored in the coin object ---
                context.drawImage(coin.img, -coin.width / 2, -coin.height / 2, coin.width, coin.height);
                context.restore();
            }

            if (!coin.collected && detectCollision(bird, coin)) {
                coin.collected = true;
                addScore(5);
                coinSound.currentTime = 0;
                coinSound.play();
            }
        }
        
        while (pipeArray.length > 0 && pipeArray[0].x < -pipeWidth) pipeArray.shift();
        coinArray = coinArray.filter(coin => coin.x + coin.width > 0);

        // Score
        context.fillStyle = "white";
        context.font = "45px sans-serif";
        context.textAlign = "left";
        context.fillText(score, 5, 45);
        context.font = "20px sans-serif";
        context.textAlign = "right";
        context.fillText(`Best: ${highScore}`, boardWidth - 8, 30);
        context.textAlign = "left";
    }

    function placePipes() {
        if (gameOver || !gameStarted) return;
        
        pipeCount++; // --- NEW: Increment the pipe counter each time ---

        // The first pipes have a large, nearly centred opening. Later openings
        // become smaller and can appear across more of the screen's height.
        const openingSpace = Math.max(
            minimumOpeningSpace,
            startingOpeningSpace - (pipeCount - 1) * gapReductionPerPipe
        );
        const easiestGapTop = (boardHeight - startingOpeningSpace) / 2;
        const fullRangeMin = pipeEdgeMargin;
        const fullRangeMax = boardHeight - openingSpace - pipeEdgeMargin;
        const difficulty = Math.min((pipeCount - 1) / 15, 1);
        const allowedMin = easiestGapTop + (fullRangeMin - easiestGapTop) * difficulty;
        const allowedMax = easiestGapTop + (fullRangeMax - easiestGapTop) * difficulty;
        const gapTop = allowedMin + Math.random() * Math.max(0, allowedMax - allowedMin);
        const randomPipeY = gapTop - pipeHeight;
        let topPipe = { x: pipeX, y: randomPipeY, width: pipeWidth, height: pipeHeight, passed: false, isTop: true };
        pipeArray.push(topPipe);

        let bottomPipe = { x: pipeX, y: randomPipeY + pipeHeight + openingSpace, width: pipeWidth, height: pipeHeight, isTop: false };
        pipeArray.push(bottomPipe);
        
        // --- NEW: Check the counter to decide which coin to place ---
        let currentCoinImg;
        if (pipeCount % 2 == 0) { // If the count is even, use coin 2
            currentCoinImg = coin2Img;
        } else { // If the count is odd, use coin 1
            currentCoinImg = coin1Img;
        }

        let coin = {
            x: pipeX + (pipeWidth / 2) - (coinWidth / 2),
            y: topPipe.y + pipeHeight + (openingSpace / 2) - (coinHeight / 2),
            width: coinWidth,
            height: coinHeight,
            collected: false,
            angle: 0,
            img: currentCoinImg // --- NEW: Store the correct image in the coin object ---
        };
        coinArray.push(coin);
    }

    function detectCollision(a, b) {
        return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    }

    function addScore(points) {
        score += points;
        if (score > highScore) {
            highScore = score;
            localStorage.setItem("vvBirdHighScore", highScore);
        }
    }

    function getBirdHitbox() {
        return {
            x: bird.x + birdHitboxPadding.left,
            y: bird.y + birdHitboxPadding.top,
            width: bird.width - birdHitboxPadding.left - birdHitboxPadding.right,
            height: bird.height - birdHitboxPadding.top - birdHitboxPadding.bottom
        };
    }
    
    function triggerGameOver() {
        if (!gameOver) {
            gameOver = true;
            music1.pause();
            music2.pause();
            failSound.play();
            gameOverScreen.style.display = "flex"; 
        }
    }

    function moveBird(e) {
        if (gameOver) {
            bird.y = birdY;
            velocityY = 0;
            pipeArray = [];
            coinArray = [];
            score = 0;
            gameOver = false;
            gameStarted = false;
            music1.currentTime = 0;
            music2.currentTime = 0;
            pipeCount = 0; // --- NEW: Reset the counter on restart ---
            gameOverScreen.style.display = "none";
            context.clearRect(0, 0, boardWidth, boardHeight);
        }

        if (!gameStarted) {
            gameStarted = true;
            music1.play();
        }

        velocityY = -6;
    }

    document.addEventListener("keydown", (e) => {
        if (e.code === "Space" || e.code === "ArrowUp") moveBird(e);
    });
    document.addEventListener("click", moveBird);

    setInterval(placePipes, 1500);
}

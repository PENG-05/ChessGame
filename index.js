// filepath: [index.html](http://_vscodecontentref_/0)
function detectMobileDevice() {
	// 检查设备类型的多个特征
	const userAgent = navigator.userAgent.toLowerCase();
	const isMobileUserAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(userAgent);

	// 检查屏幕尺寸 - 移动设备通常屏幕较小
	const isSmallScreen = window.innerWidth <= 768;

	// 检查触摸能力 - 但不作为唯一判断依据
	const hasTouchCapability = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

	// 组合多个因素进行判断
	return (isMobileUserAgent && hasTouchCapability) || (isSmallScreen && hasTouchCapability);
}


// 替换原有的检测代码
// 初始化棋盘和棋子
const board = document.getElementById('board');
const resultArea = document.getElementById('resultArea');
const gameStatus = document.getElementById('gameStatus');
let pieces = [];
let carPosition = { x: 4, y: 7 }; // 车的初始位置
let draggedPiece = null;
let draggedPieceElement = null;
let originalPosition = null;
let isDeleteMode = false; // 是否处于删除模式
let selectedPiece = null; // 移动端：当前选中的棋子
let isMobileDevice = detectMobileDevice();


// 棋盘状态跟踪
let moveCount = 0; // 记录车已经移动的步数
let difficultyLevel = 'normal'; // 难度级别: easy, normal, hard
let boardHistory = []; // 存储棋盘历史状态

// 全局变量，记录车是否吃掉了将，用于下一步消除行列
let kingCaptured = false;
let kingCapturedPosition = null;

// 初始化棋盘
function initBoard() {
		board.innerHTML = '';

		// 创建单元格和坐标点
		for (let y = 1; y <= 9; y++) {
				for (let x = 1; x <= 8; x++) {
						const cell = document.createElement('div');
						cell.className = 'cell';
						cell.dataset.x = x;
						cell.dataset.y = y;
						cell.dataset.coord = `(${x},${y})`;

						// 添加交叉点标记
						const intersection = document.createElement('div');
						intersection.className = 'intersection';
						cell.appendChild(intersection);

						// 添加拖拽相关事件处理
						cell.addEventListener('dragover', handleDragOver);
						cell.addEventListener('drop', handleDrop);
						cell.addEventListener('dragenter', handleDragEnter);
						cell.addEventListener('dragleave', handleDragLeave);
						cell.addEventListener('click', () => selectCell(x, y));

						board.appendChild(cell);
				}
		}

		// 初始化棋子
		pieces = [
				{ type: 'pawn', x: 4, y: 3 },
				{ type: 'pawn', x: 6, y: 3 },
				{ type: 'pawn', x: 8, y: 3 }
		];

		// 添加车
		pieces.push({ type: 'car', x: carPosition.x, y: carPosition.y });

		renderPieces();

		// 初始状态下计算最佳移动和标记危险区域
		setTimeout(() => {
				calculateBestMoveForCar();
				markDangerZones();
		}, 500);

		// 为移动端添加触摸事件处理
		if (isMobileDevice) {
				setupMobileTouchHandlers();
		}

		// 重置棋局状态计数器
		moveCount = 0;
		boardHistory = [];

		// 保存初始棋盘状态
		saveBoardState();
}

// 保存当前棋盘状态
function saveBoardState() {
		boardHistory.push(JSON.stringify(pieces));
}

// 渲染棋子 - 修改为支持移动端
function renderPieces() {
		// 清除所有棋子
		document.querySelectorAll('.piece').forEach(p => p.remove());
		document.querySelectorAll('.cell').forEach(c => {
				c.classList.remove('selected');
				c.classList.remove('move-suggestion');
				c.classList.remove('valid-drop');
				c.classList.remove('invalid-drop');
				// 保留危险区域标记
		});

		// 添加棋子 - 放回格子内
		pieces.forEach(piece => {
				const cell = findCell(piece.x, piece.y);
				if (!cell) return;

				const pieceElem = document.createElement('div');
				pieceElem.className = `piece ${piece.type}`;
				pieceElem.textContent = getPieceSymbol(piece.type);

				if (!isMobileDevice) {
						// 桌面端：设置拖拽属性
						pieceElem.draggable = true;
						pieceElem.addEventListener('dragstart', (e) => handleDragStart(e, piece));
						pieceElem.addEventListener('dragend', handleDragEnd);
				} else {
						// 移动端：设置点击事件
						pieceElem.addEventListener('click', (e) => {
								e.stopPropagation();
								handleMobilePieceClick(piece);
						});
				}

				// 添加删除功能 - 点击删除棋子
				pieceElem.addEventListener('click', (e) => {
						if (isDeleteMode && piece.type !== 'car') { // 不允许删除车
								deletePiece(piece);
								e.stopPropagation(); // 防止触发单元格的点击事件
						}
				});

				cell.appendChild(pieceElem);
		});

		// 高亮车的位置
		const carCell = findCell(carPosition.x, carPosition.y);
		if (carCell) {
				carCell.classList.add('selected');
		}

		// 如果在删除模式，添加删除模式类
		if (isDeleteMode) {
				board.classList.add('delete-mode');
		} else {
				board.classList.remove('delete-mode');
		}

		// 显示当前选中的棋子（移动端）
		if (selectedPiece) {
				const selectedCell = findCell(selectedPiece.x, selectedPiece.y);
				if (selectedCell) {
						selectedCell.classList.add('selected');

						// 显示可能的移动位置（如果是车）
						if (selectedPiece.type === 'car') {
								showPossibleMoves();
						}
				}
		}
}

// 删除棋子函数
function deletePiece(piece) {
		if (piece.type === 'car') {
				alert('不能删除车！');
				return;
		}

		// 从数组中移除棋子
		pieces = pieces.filter(p => p !== piece);

		// 更新状态
		gameStatus.textContent = `删除了 ${getPieceSymbol(piece.type)} 在坐标 (${piece.x}, ${piece.y})`;

		// 重新渲染棋盘
		renderPieces();

		// 重新计算最佳移动
		setTimeout(calculateBestMoveForCar, 500);
}

// 切换删除模式
function toggleDeleteMode() {
		isDeleteMode = !isDeleteMode;

		const deleteBtn = document.getElementById('toggleDeleteMode');
		if (isDeleteMode) {
				deleteBtn.textContent = '退出删除模式';
				gameStatus.textContent = '删除模式：点击棋子可以删除它（车不能删除）';
		} else {
				deleteBtn.textContent = '删除棋子';
				gameStatus.textContent = '已退出删除模式';
		}

		renderPieces();
}

// 拖拽开始
function handleDragStart(e, piece) {
		// 如果处于删除模式，不允许拖拽
		if (isDeleteMode) {
				e.preventDefault();
				return;
		}

		draggedPiece = piece;
		draggedPieceElement = e.target;
		originalPosition = { x: piece.x, y: piece.y };

		// 设置拖拽效果
		e.target.classList.add('dragging');

		// 显示可能的移动位置
		if (piece.type === 'car') {
				showPossibleMoves();
		}

		// 延迟设置，确保能看到拖拽的元素
		setTimeout(() => {
				e.target.style.opacity = '0.4';
		}, 0);
}

// 拖拽经过
function handleDragOver(e) {
		if (e.preventDefault) {
				e.preventDefault(); // 允许放置
		}
		return false;
}

// 拖拽进入
function handleDragEnter(e) {
		// 获取目标单元格坐标
		const targetX = parseInt(this.dataset.x);
		const targetY = parseInt(this.dataset.y);

		// 拖拽布局模式：所有棋子都能放在任意位置，只要该位置没有其他棋子
		if (draggedPiece) {
				if (!pieces.some(p => p !== draggedPiece && p.x === targetX && p.y === targetY)) {
						this.classList.add('valid-drop');
				} else {
						this.classList.add('invalid-drop');
				}
		}
}

// 拖拽离开
function handleDragLeave(e) {
		this.classList.remove('valid-drop');
		this.classList.remove('invalid-drop');
}

// 拖拽结束
function handleDragEnd(e) {
		// 恢复样式
		e.target.classList.remove('dragging');
		e.target.style.opacity = '1';

		// 清除高亮
		document.querySelectorAll('.cell').forEach(cell => {
				cell.classList.remove('valid-drop');
				cell.classList.remove('invalid-drop');
		});

		draggedPiece = null;
		draggedPieceElement = null;
}

// 拖拽放置
function handleDrop(e) {
    e.preventDefault();

    if (!draggedPiece) return;

    // 获取目标单元格坐标
    const targetX = parseInt(this.dataset.x);
    const targetY = parseInt(this.dataset.y);

    // 检查目标位置是否已有棋子（除了被拖拽的棋子自身）
    const targetPiece = pieces.find(p => p !== draggedPiece && p.x === targetX && p.y === targetY);

    // 如果是车并且目标位置有其他棋子，则吃掉它
    if (draggedPiece.type === 'car' && targetPiece) {
        // 检查是否吃掉了将
        const isKing = targetPiece.type === 'king';

        pieces = pieces.filter(p => p !== targetPiece);
        gameStatus.textContent = `吃掉了 ${getPieceSymbol(targetPiece.type)} 在坐标 (${targetX}, ${targetY})`;

        if (isKing) {
            kingCaptured = true;
            kingCapturedPosition = { x: targetX, y: targetY };
            gameStatus.textContent += "，下一步车移动后将消除该位置所在的行和列上的所有棋子！";
        }

        // 播放吃子动画
        this.classList.add('captured');
        setTimeout(() => this.classList.remove('captured'), 500);
    } else if (targetPiece) {
        // 其他棋子不能移动到有棋子的位置
        return false;
    }

    // 更新棋子位置
    draggedPiece.x = targetX;
    draggedPiece.y = targetY;

    // 如果是车，更新车的位置
    if (draggedPiece.type === 'car') {
        carPosition = { x: targetX, y: targetY };

        // 检查是否需要执行行列消除（如果上一步吃掉了将）
        if (kingCaptured) {
            clearRowAndColumn(targetX, targetY); // 消除当前位置所在的行和列
            kingCaptured = false; // 重置标记
            kingCapturedPosition = null;
        }

        // 检查车是否进入危险区域
        if (isCarInDanger()) {
            gameStatus.textContent = '车进入了敌方棋子的攻击范围，游戏结束！';
            setTimeout(() => {
                alert('车进入了敌方棋子的攻击范围，游戏结束！');
            }, 100);
        }
    }

    renderPieces();

    // 棋盘状态改变，重新计算最佳移动（但不自动移动红车）
    setTimeout(() => {
        // 只计算并显示建议，不执行移动
        calculateBestMoveForCar();
        
        // 如果非车棋子移动，则标记危险区域
        if (draggedPiece.type !== 'car') {
            markDangerZones();
        }
    }, 500);

    return false;
}

// 获取棋盘上所有危险的坐标点
function getDangerZones() {
		const dangerZones = [];
		const otherPieces = pieces.filter(p => p.type !== 'car');

		// 检查棋盘上每个坐标点
		for (let x = 1; x <= 8; x++) {
				for (let y = 1; y <= 9; y++) {
						// 如果当前位置有非车的棋子，跳过
						if (otherPieces.some(p => p.x === x && p.y === y)) {
								continue;
						}

						// 检查是否有任意棋子可以攻击到该坐标
						const isUnderAttack = otherPieces.some(piece => canPieceAttack(piece, x, y));

						if (isUnderAttack) {
								dangerZones.push({ x, y });
						}
				}
		}

		return dangerZones;
}

// 标记所有危险区域
function markDangerZones() {
		// 清除所有危险区域标记
		document.querySelectorAll('.cell').forEach(cell => {
				cell.classList.remove('danger-zone');
		});

		// 获取所有危险区域
		const dangerZones = getDangerZones();

		// 标记危险区域
		dangerZones.forEach(zone => {
				const cell = findCell(zone.x, zone.y);
				if (cell) {
						cell.classList.add('danger-zone');
				}
		});

		// 更新游戏状态信息
		const dangerCount = dangerZones.length;
		if (dangerCount > 0) {
				gameStatus.innerHTML = `游戏状态：已标记出 <strong>${dangerCount}</strong> 个危险坐标点，车移动到这些位置会被吃掉导致游戏结束。`;
		}
}

// 添加移动端触摸事件处理
function setupMobileTouchHandlers() {
		// 这个函数被调用但未定义，现在实现它
		console.log("设置移动端触摸事件处理");

		// 移动端不需要特别的处理，因为我们已经使用了点击事件
		// 但我们可以添加一些特定于移动设备的辅助功能

		// 更新游戏状态提示
		gameStatus.innerHTML = `游戏状态：移动设备模式已启用。<br>先点击棋子选择，再点击目标位置移动。`;
}

// 处理移动端棋子点击
function handleMobilePieceClick(piece) {
		// 清除之前的选择
		if (selectedPiece && selectedPiece !== piece) {
				// 如果之前选择的是车，现在点击的是另一个棋子
				if (selectedPiece.type === 'car') {
						// 检查是否可以吃掉该棋子
						if (isValidCarMove(selectedPiece.x, selectedPiece.y, piece.x, piece.y)) {
								// 执行吃子操作
								pieces = pieces.filter(p => p !== piece);

								// 播放吃子动画
								const cell = findCell(piece.x, piece.y);
								if (cell) {
										cell.classList.add('captured');
										setTimeout(() => cell.classList.remove('captured'), 500);
								}

								// 移动车
								selectedPiece.x = piece.x;
								selectedPiece.y = piece.y;
								carPosition = { x: piece.x, y: piece.y };

								// 更新状态
								gameStatus.textContent = `车吃掉了 ${getPieceSymbol(piece.type)} 移动到 (${piece.x}, ${piece.y})`;

								// 清除选择状态
								selectedPiece = null;

								// 重绘棋盘
								renderPieces();

								// 检查游戏状态
								if (isCarInDanger()) {
										gameStatus.textContent = '车进入了敌方棋子的攻击范围，游戏结束！';
										setTimeout(() => {
												alert('车进入了敌方棋子的攻击范围，游戏结束！');
												// initBoard();
										}, 100);
										return;
								}

								// 重新计算最佳移动
								setTimeout(calculateBestMoveForCar, 500);
								return;
						}
				}
		}

		// 新的选择
		selectedPiece = piece;

		// 更新游戏状态
		gameStatus.textContent = `已选中 ${getPieceSymbol(piece.type)} 在坐标 (${piece.x}, ${piece.y})。点击目标位置移动。`;

		// 如果是车，显示可能的移动位置
		if (piece.type === 'car') {
				showPossibleMoves();
		}

		// 重绘棋盘以显示选中状态
		renderPieces();
}

// 计算车的最佳移动
function calculateBestMoveForCar() {
		// 获取车的当前位置
		const car = pieces.find(p => p.type === 'car');
		if (!car) {
				resultArea.innerHTML = `<h3>车的最佳移动</h3><p>未找到车，请确保棋盘上有车。</p>`;
				return;
		}

		// 标记危险区域
		markDangerZones();

		// 获取车可能的安全移动
		const safeMoves = getSafeMovesForCar();

		if (safeMoves.length === 0) {
				resultArea.innerHTML = `<h3>车的最佳移动</h3><p>没有安全的移动位置！车可能被围困。</p>`;
				return;
		}

		// 为每个可能的移动计算评分
		const scoredMoves = safeMoves.map(move => {
				// 基础评分
				let score = 0;

				// 检查是否可以吃掉敌方棋子
				const targetPiece = pieces.find(p => p !== car && p.x === move.x && p.y === move.y);
				if (targetPiece) {
						// 吃子得分，根据棋子类型加分，特别重视将
						switch (targetPiece.type) {
								case 'king': score += 1000; break;  // 大幅提高吃将的优先级
								case 'rook': score += 70; break;    // 提高吃车的优先级
								case 'cannon': score += 60; break;  // 提高吃炮的优先级
								case 'knight': score += 50; break;  // 提高吃马的优先级
								case 'bishop': score += 40; break;
								case 'advisor': score += 30; break;
								case 'pawn': score += 20; break;
						}
				}

				// 计算各个方向可吃到的棋子数量
				const capturablePiecesMap = countCapturablePiecesInAllDirections(move.x, move.y);
				const totalCapturablePieces = capturablePiecesMap.total;

				// 根据可吃棋子数量加分
				score += totalCapturablePieces * 15;

				// 如果吃将后下一步可以消除更多棋子，额外加分
				if (targetPiece && targetPiece.type === 'king') {
						// 找出消除效果最好的下一步位置
						const bestClearPosition = findBestPositionAfterEatingKing(car.x, car.y, move.x, move.y);
						if (bestClearPosition) {
								score += bestClearPosition.score * 0.7;  // 将下一步可能的收益计入当前评分
						}
				}

				// 优先考虑能保持灵活性的位置（棋盘中央）
				const centerDistanceX = Math.abs(move.x - 4.5);
				const centerDistanceY = Math.abs(move.y - 5);
				const centerScore = (4 - centerDistanceX) + (4 - centerDistanceY);
				score += centerScore;

				return {
						...move,
						score,
						capturableCount: totalCapturablePieces,
						capturablePiecesMap  // 保存各方向可吃子数据用于展示
				};
		});

		// 按评分排序，选择最佳移动
		scoredMoves.sort((a, b) => b.score - a.score);
		const bestMove = scoredMoves[0];

		// 查找是否有能直接吃子的走法
		const directCaptureMove = scoredMoves.find(m =>
				pieces.some(p => p.type !== 'car' && p.x === m.x && p.y === m.y)
		);

		// 查找可吃子最多的走法
		const maxCapturableMove = [...scoredMoves].sort((a, b) => b.capturableCount - a.capturableCount)[0];

		// 更新结果区域
		let moveDescription = "";
		const targetPiece = pieces.find(p => p !== car && p.x === bestMove.x && p.y === bestMove.y);

		if (targetPiece) {
				moveDescription = `<strong>吃掉${getPieceSymbol(targetPiece.type)}</strong>在坐标(${bestMove.x}, ${bestMove.y})`;
				if (targetPiece.type === 'king') {
						moveDescription += "，下一步可消除行列上的棋子";
				}
		} else {
				moveDescription = `移动到坐标(${bestMove.x}, ${bestMove.y})`;
				if (bestMove.capturableCount > 0) {
						moveDescription += `，该位置可以威胁到${bestMove.capturableCount}个棋子`;
				}
		}

		// 计算各个方向可吃到的棋子
		const directionInfo = [];
		if (bestMove.capturablePiecesMap) {
				if (bestMove.capturablePiecesMap.left > 0)
						directionInfo.push(`左：${bestMove.capturablePiecesMap.left}个`);
				if (bestMove.capturablePiecesMap.right > 0)
						directionInfo.push(`右：${bestMove.capturablePiecesMap.right}个`);
				if (bestMove.capturablePiecesMap.up > 0)
						directionInfo.push(`上：${bestMove.capturablePiecesMap.up}个`);
				if (bestMove.capturablePiecesMap.down > 0)
						directionInfo.push(`下：${bestMove.capturablePiecesMap.down}个`);
		}

		let directCaptureInfo = "";
		if (directCaptureMove && directCaptureMove !== bestMove) {
				const captureTarget = pieces.find(p => p.type !== 'car' && p.x === directCaptureMove.x && p.y === directCaptureMove.y);
				directCaptureInfo = `<p>可直接吃子: (${directCaptureMove.x}, ${directCaptureMove.y}) 的 ${getPieceSymbol(captureTarget.type)}</p>`;
		}

		let maxCapturableInfo = "";
		if (maxCapturableMove !== bestMove) {
				maxCapturableInfo = `<p>最多威胁棋子: (${maxCapturableMove.x}, ${maxCapturableMove.y}) 可威胁 ${maxCapturableMove.capturableCount} 个棋子</p>`;
		}

		resultArea.innerHTML = `
				<h3>车的最佳移动</h3>
				<p>建议: ${moveDescription}</p>
				<p>评分: ${bestMove.score.toFixed(1)}</p>
				<p>可选移动: ${safeMoves.length}个安全位置</p>
				${directionInfo.length > 0 ? `<p>各方向威胁: ${directionInfo.join('、')}</p>` : ''}
				${directCaptureInfo}
				${maxCapturableInfo}
		`;

		// 高亮显示最佳移动位置
		document.querySelectorAll('.cell').forEach(c => c.classList.remove('move-suggestion'));
		const bestCell = findCell(bestMove.x, bestMove.y);
		if (bestCell) {
				bestCell.classList.add('move-suggestion');
		}

		// 如果有其他有价值的移动，也高亮显示
		if (directCaptureMove && directCaptureMove !== bestMove) {
				const captureCell = findCell(directCaptureMove.x, directCaptureMove.y);
				if (captureCell) captureCell.classList.add('move-suggestion');
		}

		if (maxCapturableMove && maxCapturableMove !== bestMove && maxCapturableMove !== directCaptureMove) {
				const maxCell = findCell(maxCapturableMove.x, maxCapturableMove.y);
				if (maxCell) maxCell.classList.add('move-suggestion');
		}
}

// 计算所有方向可以威胁到的棋子数量
function countCapturablePiecesInAllDirections(x, y) {
		const result = {
				left: 0,
				right: 0,
				up: 0,
				down: 0,
				total: 0
		};

		// 检查左边
		for (let i = x - 1; i >= 1; i--) {
				if (pieces.some(p => p.x === i && p.y === y)) {
						result.left++;
						break;
				}
		}

		// 检查右边
		for (let i = x + 1; i <= 8; i++) {
				if (pieces.some(p => p.x === i && p.y === y)) {
						result.right++;
						break;
				}
		}

		// 检查上面
		for (let i = y - 1; i >= 1; i--) {
				if (pieces.some(p => p.x === x && p.y === i)) {
						result.up++;
						break;
				}
		}

		// 检查下面
		for (let i = y + 1; i <= 9; i++) {
				if (pieces.some(p => p.x === x && p.y === i)) {
						result.down++;
						break;
				}
		}

		result.total = result.left + result.right + result.up + result.down;
		return result;
}

// 找出吃掉将后，下一步可以最大化消除效果的位置
function findBestPositionAfterEatingKing(carX, carY, kingX, kingY) {
		// 假设车已经吃掉了将
		const simulatedPieces = [...pieces.filter(p => !(p.x === kingX && p.y === kingY))];
		const carIndex = simulatedPieces.findIndex(p => p.type === 'car');
		if (carIndex >= 0) {
				simulatedPieces[carIndex].x = kingX;
				simulatedPieces[carIndex].y = kingY;
		}

		let bestPosition = null;
		let maxPiecesCleared = 0;

		// 检查所有可以移动到的位置
		for (let x = 1; x <= 8; x++) {
				for (let y = 1; y <= 9; y++) {
						// 跳过当前位置
						if (x === kingX && y === kingY) continue;

						// 检查是否可以从吃将位置移动到这个位置
						if (!isPathBlockedInPieces(simulatedPieces, kingX, kingY, x, y)) {
								// 计算这个位置可以消除多少棋子
								let clearCount = 0;
								simulatedPieces.forEach(p => {
										if (p.type !== 'car' && (p.x === x || p.y === y)) {
												clearCount++;
										}
								});

								if (clearCount > maxPiecesCleared) {
										maxPiecesCleared = clearCount;
										bestPosition = { x, y, score: clearCount * 20 }; // 假定每个棋子价值20分
								}
						}
				}
		}

		return bestPosition;
}

// 检查自定义棋子集合中的路径是否被阻塞
function isPathBlockedInPieces(piecesList, fromX, fromY, toX, toY) {
		// 如果不是直线移动，返回true
		if (fromX !== toX && fromY !== toY) return true;

		if (fromX === toX) {
				// 垂直移动
				const minY = Math.min(fromY, toY);
				const maxY = Math.max(fromY, toY);
				for (let y = minY + 1; y < maxY; y++) {
						if (piecesList.some(p => p.x === fromX && p.y === y)) {
								return true;
						}
				}
		} else {
				// 水平移动
				const minX = Math.min(fromX, toX);
				const maxX = Math.max(fromX, toX);
				for (let x = minX + 1; x < maxX; x++) {
						if (piecesList.some(p => p.x === x && p.y === fromY)) {
								return true;
						}
				}
		}

		return false;
}

// 检查棋子是否可以攻击到指定位置
function canPieceAttack(piece, x, y) {
		switch (piece.type) {
				case 'pawn':
						// 卒可以上下左右移动一步
						return Math.abs(piece.x - x) + Math.abs(piece.y - y) === 1;

				case 'rook':
						// 车走直线且不能越子
						return (piece.x === x || piece.y === y) && !isPathBlocked(piece.x, piece.y, x, y);

				case 'knight':
						// 马走日字，但是可能被蹩马腿
						if ((Math.abs(piece.x - x) === 1 && Math.abs(piece.y - y) === 2) ||
								(Math.abs(piece.x - x) === 2 && Math.abs(piece.y - y) === 1)) {
								// 检查蹩马腿
								if (Math.abs(piece.x - x) === 1) {
										// 竖着的日，检查横向的别腿点
										const blockY = piece.y + (y > piece.y ? 1 : -1);
										return !pieces.some(p => p.x === piece.x && p.y === blockY);
								} else {
										// 横着的日，检查纵向的别腿点
										const blockX = piece.x + (x > piece.x ? 1 : -1);
										return !pieces.some(p => p.x === blockX && p.y === piece.y);
								}
						}
						return false;

				case 'cannon':
						// 炮必须在同一直线上
						if (piece.x !== x && piece.y !== y) return false;

						// 计算炮和目标位置之间的棋子数
						const pieceCount = countPiecesInPath(piece.x, piece.y, x, y);

						// 如果炮和目标位置之间有一个棋子，且目标位置有棋子，则可以攻击
						if (pieceCount === 1 && pieces.some(p => p.x === x && p.y === y)) {
								return true;
						}

						// 如果炮和目标位置之间有一个棋子，且目标位置是空的，则标记为危险区域
						if (pieceCount === 1 && !pieces.some(p => p.x === x && p.y === y)) {
								return true;
						}

						return false;

				case 'bishop': // 象
						// 象走田字格
						if (Math.abs(piece.x - x) === 2 && Math.abs(piece.y - y) === 2) {
								// 象眼位置
								const eyeX = (piece.x + x) / 2;
								const eyeY = (piece.y + y) / 2;

								// 检查象眼是否被塞象眼
								if (pieces.some(p => p.x === eyeX && p.y === eyeY)) {
										return false;
								}

								// 移除过河限制，只要是田字格走法即可
								return true;
						}
						return false;

				case 'advisor': // 士
						// 士一次只能走一个对角线格，不再限制在九宫格内
						if (Math.abs(piece.x - x) === 1 && Math.abs(piece.y - y) === 1) {
								return true;
						}
						return false;

				case 'king': // 将
						// 将可以上下左右走一格，不再限制在九宫格内
						if (Math.abs(piece.x - x) + Math.abs(piece.y - y) === 1) {
								return true; // 移除九宫格限制
						}
						return false;

				default:
						return false;
		}
}

// 检查路径上是否有棋子阻挡
function isPathBlocked(fromX, fromY, toX, toY) {
		// 必须是直线移动
		if (fromX !== toX && fromY !== toY) return true;

		return countPiecesInPath(fromX, fromY, toX, toY) > 0;
}

// 计算路径上的棋子数量
function countPiecesInPath(fromX, fromY, toX, toY) {
		let count = 0;

		if (fromX === toX) {
				// 垂直移动
				const minY = Math.min(fromY, toY);
				const maxY = Math.max(fromY, toY);
				for (let y = minY + 1; y < maxY; y++) {
						if (pieces.some(p => p.x === fromX && p.y === y)) {
								count++;
						}
				}
		} else if (fromY === toY) {
				// 水平移动
				const minX = Math.min(fromX, toX);
				const maxX = Math.max(fromX, toX);
				for (let x = minX + 1; x < maxX; x++) {
						if (pieces.some(p => p.x === x && p.y === fromY)) {
								count++;
						}
				}
		}

		return count;
}

// 检查棋子移动到新位置是否能阻止车吃子
function canBlockCarFromCapturing(simulatedPieces, newX, newY) {
		// 找到车的位置
		const car = simulatedPieces.find(p => p.type === 'car');
		if (!car) return false;

		// 找到所有可能被车吃掉的棋子
		const capturablePieces = simulatedPieces.filter(p => {
				if (p.type === 'car') return false;

				// 检查车是否可以直接吃掉该棋子
				if ((car.x === p.x || car.y === p.y) &&
						!isPathBlockedInSimulation(simulatedPieces, car.x, car.y, p.x, p.y)) {
						return true;
				}
				return false;
		});

		// 如果没有可以被吃掉的棋子，则不需要阻挡
		if (capturablePieces.length === 0) return true;

		// 检查新位置是否能阻挡车吃棋子
		return capturablePieces.some(p => {
				// 检查新位置是否在车和目标棋子之间
				if (car.x === p.x && car.x === newX) {
						const minY = Math.min(car.y, p.y);
						const maxY = Math.max(car.y, p.y);
						return newY > minY && newY < maxY;
				}
				if (car.y === p.y && car.y === newY) {
						const minX = Math.min(car.x, p.x);
						const maxX = Math.max(car.x, p.x);
						return newX > minX && newX < maxX;
				}
				return false;
		});
}

// 计算位置得分，用于评估移动的好坏
function getPositionScore(x, y) {
		let score = 0;

		// 远离边缘得更高分
		score += Math.min(x - 1, 8 - x) * 0.5;
		score += Math.min(y - 1, 9 - y) * 0.5;

		// 接近中心得高分
		score += (4.5 - Math.abs(x - 4.5)) * 0.8;
		score += (5 - Math.abs(y - 5)) * 0.8;

		// 如果位置更接近车，得分更高（因为可能更有效地阻挡）
		const car = pieces.find(p => p.type === 'car');
		if (car) {
				const distance = Math.abs(x - car.x) + Math.abs(y - car.y);
				score += (10 - distance) * 0.3;
		}

		return score;
}

// 在模拟环境中检查路径是否被阻挡
function isPathBlockedInSimulation(simulatedPieces, fromX, fromY, toX, toY) {
		// 必须是直线移动
		if (fromX !== toX && fromY !== toY) return true;

		if (fromX === toX) {
				// 垂直移动
				const minY = Math.min(fromY, toY);
				const maxY = Math.max(fromY, toY);
				for (let y = minY + 1; y < maxY; y++) {
						if (simulatedPieces.some(p => p.x === fromX && p.y === y)) {
								return true;
						}
				}
		} else {
				// 水平移动
				const minX = Math.min(fromX, toX);
				const maxX = Math.max(fromX, toX);
				for (let x = minX + 1; x < maxX; x++) {
						if (simulatedPieces.some(p => p.x === x && p.y === fromY)) {
								return true;
						}
				}
		}

		return false;
}

// 检查车的移动是否有效
function isValidCarMove(fromX, fromY, toX, toY) {
		// 检查是否是直线移动
		if (fromX !== toX && fromY !== toY) {
				return false;
		}

		// 检查路径上是否有其他棋子
		if (isPathBlocked(fromX, fromY, toX, toY)) {
				return false;
		}

		return true;
}

// 获取棋子符号
function getPieceSymbol(type) {
		switch (type) {
				case 'car': return '车';
				case 'pawn': return '卒';
				case 'rook': return '车';
				case 'knight': return '马';
				case 'cannon': return '炮';
				case 'bishop': return '象';
				case 'advisor': return '士';
				case 'king': return '将';
				default: return '?';
		}
}

// 查找指定坐标的单元格
function findCell(x, y) {
		return document.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
}

// 选择单元格 - 移除自动移动车的逻辑
function selectCell(x, y) {
    // 如果处于删除模式，点击空格子不做任何操作
    if (isDeleteMode) {
        return;
    }

    const piece = pieces.find(p => p.x === x && p.y === y);

    if (isMobileDevice) {
        // 移动端逻辑
        if (piece) {
            // 如果已经有选中的棋子，并且它是车，则尝试吃子
            if (selectedPiece && selectedPiece.type === 'car') {
                // 检查车是否可以移动到该位置吃子
                if (isValidCarMove(selectedPiece.x, selectedPiece.y, x, y)) {
                    // 检查是否吃掉了将
                    const isKing = piece.type === 'king';

                    // 吃掉棋子
                    pieces = pieces.filter(p => p !== piece);
                    gameStatus.textContent = `吃掉了 ${getPieceSymbol(piece.type)} 在坐标 (${x}, ${y})`;

                    if (isKing) {
                        kingCaptured = true;
                        kingCapturedPosition = { x, y };
                        gameStatus.textContent += "，下一步将消除该位置所在的行和列上的所有棋子！";
                    }

                    // 播放吃子动画
                    const cell = findCell(x, y);
                    if (cell) {
                        cell.classList.add('captured');
                        setTimeout(() => cell.classList.remove('captured'), 500);
                    }

                    // 移动车
                    selectedPiece.x = x;
                    selectedPiece.y = y;
                    carPosition = { x, y };

                    // 清除选择状态
                    selectedPiece = null;

                    // 重绘棋盘
                    renderPieces();

                    // 检查游戏状态
                    if (isCarInDanger()) {
                        gameStatus.textContent = '车进入了敌方棋子的攻击范围，游戏结束！';
                        setTimeout(() => {
                                alert('车进入了敌方棋子的攻击范围，游戏结束！');
                        }, 100);
                        return;
                    }

                    // 重新计算最佳移动
                    setTimeout(calculateBestMoveForCar, 500);
                    return;
                } else {
                    gameStatus.textContent = "无法吃掉该棋子！车只能直线移动且不能越过其他棋子";
                    return;
                }
            }
            else {
                // 如果没有选中棋子，或选中的不是车，则选择点击的棋子
                handleMobilePieceClick(piece);
            }
        } else if (selectedPiece) {
            // 空单元格且有选中棋子，尝试移动
            if (selectedPiece.type === 'car') {
                // 检查是否可以移动到该位置
                if (isValidCarMove(selectedPiece.x, selectedPiece.y, x, y)) {
                    // 检查是否需要执行行列消除
                    const shouldClearRowColumn = kingCaptured;

                    // 移动车
                    selectedPiece.x = x;
                    selectedPiece.y = y;
                    carPosition = { x, y };

                    // 如果上一步吃掉了将，这一步需要消除行列
                    if (shouldClearRowColumn && kingCapturedPosition) {
                        clearRowAndColumn(x, y);
                        kingCaptured = false; // 重置状态
                        kingCapturedPosition = null;
                    }

                    // 清除选择状态
                    selectedPiece = null;

                    // 重绘棋盘
                    renderPieces();

                    // 检查车是否安全
                    if (isCarInDanger()) {
                        gameStatus.textContent = '车进入了敌方棋子的攻击范围，游戏结束！';
                        setTimeout(() => {
                                alert('车进入了敌方棋子的攻击范围，游戏结束！');
                        }, 100);
                        return;
                    }

                    gameStatus.textContent = `车移动到坐标 (${x}, ${y})`;
                    if (shouldClearRowColumn) {
                        gameStatus.textContent += "，已消除该位置所在的行和列上的所有棋子！";
                    }

                    // 重新计算最佳移动
                    setTimeout(calculateBestMoveForCar, 500);
                    return;
                } else {
                    gameStatus.textContent = "无法移动到该位置！车只能直线移动且不能越过其他棋子";
                    return;
                }
            } else {
                // 其他棋子的移动逻辑
                gameStatus.textContent = "只有车可以移动。请操作红色的车棋子。";
            }
        }
    } else {
        // 桌面端逻辑
        if (piece && piece.type === 'car') {
            // 如果点击的是车，显示可能的移动位置
            showPossibleMoves();
            gameStatus.textContent = `已选中车，请拖动车或点击绿色建议位置查看分析`;
        } else if (piece) {
            // 如果点击的是其他棋子
            gameStatus.textContent = `选中的棋子: ${getPieceSymbol(piece.type)} 在坐标 (${x}, ${y})，只有车可以移动`;
        } else {
            // 空单元格点击 - 只显示信息
            gameStatus.textContent = `已选择坐标 (${x}, ${y})`;

            // 高亮显示选中的单元格
            document.querySelectorAll('.cell').forEach(cell => {
                cell.classList.remove('selected');
                if (cell !== findCell(carPosition.x, carPosition.y)) {
                    cell.classList.remove('move-suggestion');
                }
            });
            const selectedCell = findCell(x, y);
            if (selectedCell) {
                selectedCell.classList.add('selected');
                setTimeout(() => {
                    if (selectedCell !== findCell(carPosition.x, carPosition.y)) {
                        selectedCell.classList.remove('selected');
                    }
                }, 1000);
            }

            // 检查选中的单元格是否是建议的移动位置
            if (selectedCell && selectedCell.classList.contains('move-suggestion')) {
                // 分析此位置的价值，但不自动移动
                analyzePosition(x, y);
            }
        }
    }
}

// 分析指定位置的价值 - 添加这个缺失的函数
function analyzePosition(x, y) {
    const car = pieces.find(p => p.type === 'car');
    if (!car) return;
    
    // 检查目标位置是否有棋子可以吃
    const targetPiece = pieces.find(p => p !== car && p.x === x && p.y === y);
    let analysisHtml = `<h3>位置分析 (${x}, ${y})</h3>`;
    
    // 计算各个方向可吃到的棋子
    const capturablePiecesMap = countCapturablePiecesInAllDirections(x, y);
    const totalCapturablePieces = capturablePiecesMap.total;
    
    // 基础评分计算
    let score = 0;
    
    // 如果可以吃子，加分
    if (targetPiece) {
        // 吃子得分
        switch (targetPiece.type) {
            case 'king': score += 1000; break;
            case 'rook': score += 70; break;
            case 'cannon': score += 60; break;
            case 'knight': score += 50; break;
            case 'bishop': score += 40; break;
            case 'advisor': score += 30; break;
            case 'pawn': score += 20; break;
        }
        analysisHtml += `<p>✓ <strong>吃子优势</strong>: 可吃掉 ${getPieceSymbol(targetPiece.type)} (+${score}分)</p>`;
    } else {
        analysisHtml += `<p>✗ <strong>吃子优势</strong>: 此位置没有可吃的棋子</p>`;
    }
    
    // 威胁分析
    if (totalCapturablePieces > 0) {
        score += totalCapturablePieces * 15;
        const directionInfo = [];
        if (capturablePiecesMap.left > 0) directionInfo.push(`左：${capturablePiecesMap.left}个`);
        if (capturablePiecesMap.right > 0) directionInfo.push(`右：${capturablePiecesMap.right}个`);
        if (capturablePiecesMap.up > 0) directionInfo.push(`上：${capturablePiecesMap.up}个`);
        if (capturablePiecesMap.down > 0) directionInfo.push(`下：${capturablePiecesMap.down}个`);
        
        analysisHtml += `<p>✓ <strong>威胁优势</strong>: 可威胁 ${totalCapturablePieces} 个棋子 (+${totalCapturablePieces * 15}分)<br>
            各方向: ${directionInfo.join('、')}</p>`;
    } else {
        analysisHtml += `<p>✗ <strong>威胁优势</strong>: 无法威胁任何棋子</p>`;
    }
    
    // 中心控制分析
    const centerDistanceX = Math.abs(x - 4.5);
    const centerDistanceY = Math.abs(y - 5);
    const centerScore = (4 - centerDistanceX) + (4 - centerDistanceY);
    score += centerScore;
    
    analysisHtml += `<p>✓ <strong>位置控制</strong>: 接近棋盘中心 (+${centerScore.toFixed(1)}分)</p>`;
    
    // 特殊情况：吃将后的行列消除效果
    if (targetPiece && targetPiece.type === 'king') {
        analysisHtml += `<p>✓ <strong>特殊效果</strong>: 吃掉将后下一步可消除整行整列的所有棋子!</p>`;
        
        // 计算吃将后的最佳位置
        const bestNextPosition = findBestPositionAfterEatingKing(car.x, car.y, x, y);
        if (bestNextPosition) {
            score += bestNextPosition.score * 0.7;
            analysisHtml += `<p>✓ <strong>后续优势</strong>: 下一步移动到(${bestNextPosition.x}, ${bestNextPosition.y})可消除${Math.floor(bestNextPosition.score/20)}个棋子 (+${(bestNextPosition.score * 0.7).toFixed(1)}分)</p>`;
        }
    }
    
    // 安全性分析
    const dangerZones = getDangerZones();
    const isSafe = !dangerZones.some(zone => zone.x === x && zone.y === y);
    
    if (isSafe) {
        analysisHtml += `<p>✓ <strong>安全性</strong>: 此位置安全，不会被敌方棋子攻击到</p>`;
    } else {
        analysisHtml += `<p class="danger">⚠ <strong>危险警告</strong>: 此位置处于敌方攻击范围！不建议移动到此处</p>`;
    }
    
    // 总评分
    analysisHtml += `<p><strong>总评分</strong>: ${score.toFixed(1)}</p>`;
    
    // 操作建议
    if (isSafe) {
        analysisHtml += `<div class="move-action">
            <button class="btn" onclick="executeMove(${x}, ${y})">移动到此位置</button>
        </div>`;
    } else {
        analysisHtml += `<div class="move-action">
            <button class="btn btn-danger" onclick="executeMove(${x}, ${y})">强制移动(危险!)</button>
        </div>`;
    }
    
    // 显示分析结果
    resultArea.innerHTML = analysisHtml;
    
    // 高亮显示当前分析的位置
    document.querySelectorAll('.cell').forEach(c => {
        c.classList.remove('analyzing');
    });
    const cell = findCell(x, y);
    if (cell) cell.classList.add('analyzing');
}

// 执行移动到指定位置
function executeMove(x, y) {
    // 获取车
    const car = pieces.find(p => p.type === 'car');
    if (!car) return;
    
    // 检查路径是否合法
    if (!isValidCarMove(car.x, car.y, x, y)) {
        gameStatus.textContent = "无效移动：车只能直线移动且不能越过其他棋子";
        return;
    }
    
    // 移动车到指定位置
    moveCarTo(x, y);
    
    // 更新棋盘
    renderPieces();
    
    // 重新计算最佳移动
    setTimeout(calculateBestMoveForCar, 500);
}

// 显示车可能的移动位置，但不自动移动
function showPossibleMoves() {
		document.querySelectorAll('.cell').forEach(c => c.classList.remove('move-suggestion'));

		// 获取安全的移动位置
		const safeMoves = getSafeMovesForCar();

		// 高亮显示安全的移动位置
		safeMoves.forEach(move => {
				const cell = findCell(move.x, move.y);
				if (cell) {
						cell.classList.add('move-suggestion');
				}
		});

		// 添加点击提示
		gameStatus.textContent = `已选中车，${safeMoves.length}个可能的移动位置已标记为绿色。点击绿色位置查看详细分析。`;
}

// 移动车到指定位置
function moveCarTo(x, y) {
		// 检查是否存在车
		const carPiece = pieces.find(p => p.type === 'car');
		if (!carPiece) return;

		// 检查是否需要执行行列消除
		const shouldClearRowColumn = kingCaptured;

		// 检查目标位置是否有棋子
		const targetPiece = pieces.find(p => p.x === x && p.y === y);
		if (targetPiece) {
				// 如果是敌方棋子，吃掉它（从棋盘上移除）
				if (targetPiece.type !== 'car') {
						// 检查是否吃掉了将
						const isKing = targetPiece.type === 'king';

						pieces = pieces.filter(p => p !== targetPiece);
						gameStatus.textContent = `吃掉了 ${getPieceSymbol(targetPiece.type)} 在坐标 (${x}, ${y})`;

						if (isKing) {
								kingCaptured = true;
								kingCapturedPosition = { x, y };
								gameStatus.textContent += "，下一步将消除该位置所在的行和列上的所有棋子！";
						}

						// 播放一个简单的吃子动画效果
						const targetCell = findCell(targetPiece.x, targetPiece.y);
						if (targetCell) {
								targetCell.classList.add('captured');
								setTimeout(() => targetCell.classList.remove('captured'), 500);
						}
				}
		}

		// 移动车
		carPiece.x = x;
		carPiece.y = y;
		carPosition = { x, y };

		// 如果上一步吃掉了将，这一步需要消除行列
		if (shouldClearRowColumn) {
				clearRowAndColumn(x, y);
				kingCaptured = false; // 重置状态
				kingCapturedPosition = null;
		}

		// 增加移动计数
		moveCount++;

		// 保存移动后的棋盘状态
		saveBoardState();

		// 根据移动步数，可能需要增加新棋子
		if (moveCount % 3 === 0) {
				addRandomPieces();
		} else {
				// 可能需要调整某个棋子的位置
				maybeMovePiece();
		}

		// 重新渲染棋盘
		renderPieces();

		// 检查游戏状态
		if (isCarInDanger()) {
				gameStatus.textContent = '车进入了敌方棋子的攻击范围，游戏结束！';
				setTimeout(() => {
						alert('车进入了敌方棋子的攻击范围，游戏结束！');
				}, 100);
				return;
		}
}

// 在特定步数后添加新的随机棋子
function addRandomPieces() {
		const pieceTypes = ['pawn', 'knight', 'cannon', 'bishop', 'advisor'];

		// 添加3个新棋子
		for (let i = 0; i < 3; i++) {
				let position = findRandomEmptyPosition();
				if (position) {
						const randomType = pieceTypes[Math.floor(Math.random() * pieceTypes.length)];
						pieces.push({
								type: randomType,
								x: position.x,
								y: position.y
						});

						gameStatus.textContent = `已移动${moveCount}步，新增了${getPieceSymbol(randomType)}棋子！`;
				}
		}
}

// 找寻棋盘上的空位
function findRandomEmptyPosition() {
		// 所有可能的位置
		const allPositions = [];
		for (let x = 1; x <= 8; x++) {
				for (let y = 1; y <= 9; y++) {
						// 避免放在车的周围一圈位置
						if (Math.abs(x - carPosition.x) > 1 || Math.abs(y - carPosition.y) > 1) {
								allPositions.push({ x, y });
						}
				}
		}

		// 过滤掉已经有棋子的位置
		const emptyPositions = allPositions.filter(pos =>
				!pieces.some(p => p.x === pos.x && p.y === pos.y)
		);

		if (emptyPositions.length === 0) return null;

		// 随机选择一个空位
		return emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
}

// 在步数不是3的倍数时，可能移动一个现有棋子
function maybeMovePiece() {
		// 35%的概率会移动一个现有棋子
		if (Math.random() < 0.35) {
				const otherPieces = pieces.filter(p => p.type !== 'car');
				if (otherPieces.length > 0) {
						// 随机选择一个棋子移动
						const pieceToMove = otherPieces[Math.floor(Math.random() * otherPieces.length)];

						// 尝试找一个更安全的位置
						const newPosition = findSaferPositionForPiece(pieceToMove);
						if (newPosition) {
								const oldX = pieceToMove.x;
								const oldY = pieceToMove.y;
								pieceToMove.x = newPosition.x;
								pieceToMove.y = newPosition.y;

								gameStatus.textContent = `${getPieceSymbol(pieceToMove.type)}从(${oldX},${oldY})移动到了(${newPosition.x},${newPosition.y})`;

								// 其他棋子移动后重新计算
								setTimeout(() => {
										calculateBestMoveForCar();
										markDangerZones();
								}, 500);
						}
				}
		}
}

// 为棋子找一个更安全的位置
function findSaferPositionForPiece(piece) {
		const possibleMoves = [];

		// 考虑上下左右四个方向
		const directions = [{ dx: 0, dy: 1 }, { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: -1, dy: 0 }];

		for (const direction of directions) {
				const newX = piece.x + direction.dx;
				const newY = piece.y + direction.dy;

				// 确保位置在棋盘范围内
				if (newX >= 1 && newX <= 8 && newY >= 1 && newY <= 9) {
						// 确保新位置没有棋子
						if (!pieces.some(p => p.x === newX && p.y === newY)) {
								// 检查这个位置是否对车构成威胁
								const simulatedPieces = [...pieces];
								const pieceIndex = simulatedPieces.findIndex(p => p === piece);
								simulatedPieces[pieceIndex] = { ...piece, x: newX, y: newY };

								// 移动到这个位置后是否能阻止车吃子
								if (canBlockCarFromCapturing(simulatedPieces, newX, newY)) {
										possibleMoves.push({ x: newX, y: newY, score: getPositionScore(newX, newY) });
								}
						}
				}
		}

		// 如果有可能的移动，选择得分最高的
		if (possibleMoves.length > 0) {
				possibleMoves.sort((a, b) => b.score - a.score);
				return possibleMoves[0];
		}

		return null;
}

// 为棋子找一个更安全的位置
function getSafeMovesForCar() {
		const car = pieces.find(p => p.type === 'car');
		if (!car) return [];

		const possibleMoves = [];

		// 横向移动
		for (let x = 1; x <= 8; x++) {
				if (x !== car.x && !isPathBlocked(car.x, car.y, x, car.y)) {
						possibleMoves.push({ x, y: car.y });
				}
		}

		// 纵向移动
		for (let y = 1; y <= 9; y++) {
				if (y !== car.y && !isPathBlocked(car.x, car.y, car.x, y)) {
						possibleMoves.push({ x: car.x, y });
				}
		}

		// 过滤出安全的移动
		return possibleMoves.filter(move => {
				// 检查移动到该位置是否安全
				return !pieces.some(piece => {
						// 忽略车自己
						if (piece.type === 'car') return false;

						// 如果这个位置已经有棋子，检查是否可以吃掉它
						if (piece.x === move.x && piece.y === move.y) {
								return false; // 可以吃掉这个棋子，所以仍然是安全的
						}

						// 特殊处理炮的威胁：检查移动后位置是否会被炮隔子攻击
						if (piece.type === 'cannon') {
								// 检查是否在同一直线上
								if (piece.x === move.x || piece.y === move.y) {
										// 计算中间有几个棋子
										let pieceCount = 0;

										// 临时移动车到目标位置进行检查
										const simulatedPieces = [...pieces];
										const carIndex = simulatedPieces.findIndex(p => p.type === 'car');
										if (carIndex >= 0) { // 确保找到了车
												const originalCar = {...simulatedPieces[carIndex]};
												simulatedPieces[carIndex] = { ...originalCar, x: move.x, y: move.y };

												if (piece.x === move.x) {
														// 在同一垂直线上
														const minY = Math.min(piece.y, move.y);
														const maxY = Math.max(piece.y, move.y);

														// 统计炮和目标位置之间的棋子数量
														for (let i = minY + 1; i < maxY; i++) {
																if (simulatedPieces.some(p => 
																		p.x === move.x && p.y === i && 
																		p !== simulatedPieces[carIndex] && 
																		p !== piece)) {
																		pieceCount++;
																}
														}
												} else if (piece.y === move.y) {
														// 在同一水平线上
														const minX = Math.min(piece.x, move.x);
														const maxX = Math.max(piece.x, move.x);

														// 统计炮和目标位置之间的棋子数量
														for (let i = minX + 1; i < maxX; i++) {
																if (simulatedPieces.some(p => 
																		p.x === i && p.y === move.y && 
																		p !== simulatedPieces[carIndex] && 
																		p !== piece)) {
																		pieceCount++;
																}
														}
												}

												// 如果中间恰好有一个棋子，炮可以攻击到车
												return pieceCount === 1;
										}
								}
								return false; // 如果不在同一直线上，炮无法攻击
						}

						// 检查移动后是否会被其他棋子攻击
						return canPieceAttack(piece, move.x, move.y);
				});
		});
}

// 检查车是否在危险中
function isCarInDanger() {
		const car = pieces.find(p => p.type === 'car');
		if (!car) return false;

		// 直接检查当前车位置是否在危险区域中
		const dangerZones = getDangerZones();
		if (dangerZones.some(zone => zone.x === car.x && zone.y === car.y)) {
				return true;
		}

		// 检查每个棋子是否可以攻击到车
		return pieces.some(piece => {
				if (piece.type === 'car') return false;

				// 特殊判断炮对车的威胁
				if (piece.type === 'cannon') {
						// 检查炮是否与车在同一直线
						if (piece.x === car.x || piece.y === car.y) {
								// 计算炮和车之间的棋子数量
								let pieceCount = 0;

								if (piece.x === car.x) {
										// 在同一列
										const minY = Math.min(piece.y, car.y);
										const maxY = Math.max(piece.y, car.y);

										for (let y = minY + 1; y < maxY; y++) {
												if (pieces.some(p => p.x === car.x && p.y === y && p !== car && p !== piece)) {
														pieceCount++;
												}
										}
								} else if (piece.y === car.y) {
										// 在同一行
										const minX = Math.min(piece.x, car.x);
										const maxX = Math.max(piece.x, car.x);

										for (let x = minX + 1; x < maxX; x++) {
												if (pieces.some(p => p.x === x && p.y === car.y && p !== car && p !== piece)) {
														pieceCount++;
												}
										}
								}

								// 如果炮和车之间正好隔了一个棋子，炮可以攻击到车
								if (pieceCount === 1) {
										return true;
								}
						}
				}

				return canPieceAttack(piece, car.x, car.y);
		});
}

// 添加新棋子
document.getElementById('addPiece').addEventListener('click', () => {
		// 如果处于删除模式，先退出删除模式
		if (isDeleteMode) {
				toggleDeleteMode();
		}

		const type = document.getElementById('pieceType').value;
		const x = parseInt(document.getElementById('xCoord').value);
		const y = parseInt(document.getElementById('yCoord').value);

		// 验证输入
		if (isNaN(x) || isNaN(y) || x < 1 || x > 8 || y < 1 || y > 9) {
				alert('无效的坐标！');
				return;
		}

		// 检查该位置是否已有棋子
		if (pieces.some(p => p.x === x && p.y === y)) {
				alert('该位置已有棋子！');
				return;
		}

		// 添加棋子
		pieces.push({ type, x, y });
		renderPieces();

		gameStatus.textContent = `添加了 ${getPieceSymbol(type)} 在坐标 (${x}, ${y})`;

		// 添加棋子后重新计算最佳移动和危险区域
		setTimeout(() => {
				calculateBestMoveForCar();
				markDangerZones();
		}, 500);
});

// 删除棋子模式切换
document.getElementById('toggleDeleteMode').addEventListener('click', toggleDeleteMode);

// 计算最佳移动
document.getElementById('calculateMove').addEventListener('click', calculateBestMoveForCar);

// 重置棋盘
document.getElementById('resetBoard').addEventListener('click', () => {
		// 如果处于删除模式，先退出删除模式
		if (isDeleteMode) {
				toggleDeleteMode();
		}
		initBoard();
});

// 保存棋局到本地存储
function saveGameToLocalStorage(name) {
		if (!name) {
				alert('请输入存档名称！');
				return;
		}

		// 创建游戏存档对象
		const gameState = {
				pieces: pieces,
				carPosition: carPosition,
				timestamp: new Date().toISOString(),
				name: name
		};

		// 获取现有存档列表
		let savedGames = JSON.parse(localStorage.getItem('chessGames') || '[]');

		// 检查是否有同名存档
		const existingIndex = savedGames.findIndex(game => game.name === name);
		if (existingIndex >= 0) {
				if (confirm(`已存在名为"${name}"的存档，是否覆盖？`)) {
						savedGames[existingIndex] = gameState;
				} else {
						return;
				}
		} else {
				// 添加新存档
				savedGames.push(gameState);
		}

		// 保存到本地存储
		localStorage.setItem('chessGames', JSON.stringify(savedGames));

		gameStatus.textContent = `已成功保存棋局 "${name}"`;

		// 更新存档列表（如果已显示）
		if (document.getElementById('archiveList').style.display !== 'none') {
				loadGameList();
		}
}

// 加载棋局列表
function loadGameList() {
		const archiveList = document.getElementById('archiveList');

		// 显示存档列表区域
		archiveList.style.display = 'block';

		// 获取所有存档
		const savedGames = JSON.parse(localStorage.getItem('chessGames') || '[]');

		if (savedGames.length === 0) {
				archiveList.innerHTML = '<p>暂无存档</p>';
				return;
		}

		// 生成存档列表HTML
		let html = '';
		savedGames.forEach((game, index) => {
				const date = new Date(game.timestamp).toLocaleString();
				html += `
						<div class="archive-item">
								<div class="archive-name">${game.name} (${date})</div>
								<button class="btn btn-sm" onclick="loadGame('${game.name}')">加载</button>
								<button class="btn btn-sm btn-danger" onclick="deleteGame('${game.name}')">删除</button>
						</div>
				`;
		});

		archiveList.innerHTML = html;
}

// 加载指定存档
function loadGame(name) {
		// 获取所有存档
		const savedGames = JSON.parse(localStorage.getItem('chessGames') || '[]');

		// 查找指定存档
		const gameState = savedGames.find(game => game.name === name);

		if (!gameState) {
				alert(`找不到名为"${name}"的存档！`);
				return;
		}

		// 确认是否加载
		if (!confirm(`确定要加载"${name}"？当前棋盘将被覆盖。`)) {
				return;
		}

		// 恢复棋盘状态
		pieces = gameState.pieces;
		carPosition = gameState.carPosition;

		// 刷新棋盘
		renderPieces();

		gameStatus.textContent = `已加载棋局 "${name}"`;

		// 计算最佳移动
		setTimeout(calculateBestMoveForCar, 500);
}

// 删除存档
function deleteGame(name) {
		if (!confirm(`确定要删除"${name}"存档吗？此操作不可撤销。`)) {
				return;
		}

		// 获取所有存档
		let savedGames = JSON.parse(localStorage.getItem('chessGames') || '[]');

		// 过滤掉要删除的存档
		savedGames = savedGames.filter(game => game.name !== name);

		// 保存回本地存储
		localStorage.setItem('chessGames', JSON.stringify(savedGames));

		// 更新界面
		loadGameList();
		gameStatus.textContent = `已删除存档 "${name}"`;
}

// 导出存档为文件
function exportGame(name) {
		// 获取所有存档
		const savedGames = JSON.parse(localStorage.getItem('chessGames') || '[]');

		// 查找指定存档
		const gameState = savedGames.find(game => game.name === name);

		if (!gameState) {
				alert(`找不到名为"${name}"的存档！`);
				return;
		}

		// 将存档转换为JSON字符串
		const gameStateJson = JSON.stringify(gameState, null, 2);

		// 创建下载链接
		const blob = new Blob([gameStateJson], { type: 'application/json' });
		const url = URL.createObjectURL(blob);

		// 创建下载元素并点击
		const a = document.createElement('a');
		a.href = url;
		a.download = `${name}_棋局存档.json`;
		a.click();

		// 释放URL
		setTimeout(() => URL.revokeObjectURL(url), 100);
}

// 添加按钮事件监听器
document.getElementById('saveGame').addEventListener('click', () => {
		const name = document.getElementById('archiveName').value.trim();
		saveGameToLocalStorage(name);
});

document.getElementById('loadGameList').addEventListener('click', loadGameList);

// 添加一个新按钮用于显示/隐藏危险区域
const buttonGroup = document.querySelector('.button-group');
const toggleDangerBtn = document.createElement('button');
toggleDangerBtn.className = 'btn';
toggleDangerBtn.id = 'toggleDangerZones';
toggleDangerBtn.textContent = '显示危险区域';
toggleDangerBtn.addEventListener('click', function () {
		const cells = document.querySelectorAll('.cell.danger-zone');
		if (cells.length > 0) {
				cells.forEach(cell => cell.classList.remove('danger-zone'));
				this.textContent = '显示危险区域';
		} else {
				markDangerZones();
				this.textContent = '隐藏危险区域';
		}
});
buttonGroup.appendChild(toggleDangerBtn);

// 添加全局函数用于HTML中直接调用
window.loadGame = loadGame;
window.deleteGame = deleteGame;
window.exportGame = exportGame;

// 初始化棋盘
initBoard();

// 检测设备类型并显示相应提示
if (isMobileDevice) {
		document.getElementById('mobileControls').style.display = 'block';
		console.log("检测到移动设备，启用触摸控制");
}

// 添加新函数: 消除指定行和列上的所有棋子
function clearRowAndColumn(x, y) {
		// 记录消除前的棋子数量
		const beforeCount = pieces.length;

		// 过滤掉该行和该列上的所有非车棋子
		pieces = pieces.filter(p => {
				// 保留车
				if (p.type === 'car') return true;

				// 如果棋子在同一行或同一列上，将其移除
				if (p.x === x || p.y === y) {
						return false;
				}
				return true;
		});

		// 计算消除的棋子数量
		const removedCount = beforeCount - pieces.length;

		// 更新游戏状态信息
		if (removedCount > 0) {
				gameStatus.textContent = `消除了${removedCount}个棋子！位置(${x}, ${y})所在的行和列已清空。`;

				// 播放消除动画 (可以添加一个整行整列的动画效果)
				// 高亮显示被消除的行和列
				document.querySelectorAll('.cell').forEach(cell => {
						const cellX = parseInt(cell.dataset.x);
						const cellY = parseInt(cell.dataset.y);
						if (cellX === x || cellY === y) {
								cell.classList.add('captured');
								setTimeout(() => cell.classList.remove('captured'), 800);
						}
				});
		}
}

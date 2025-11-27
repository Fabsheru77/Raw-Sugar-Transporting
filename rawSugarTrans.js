document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const els = {
        ship: document.getElementById('ship'),
        shipGate: document.getElementById('ship-gate'),
        craneArm: document.getElementById('crane-arm'),
        craneHook: document.getElementById('crane-hook'),
        panels: [1,2,3,4,5].map(i => document.getElementById(`panel${i}`)),
        weigherGates: {
            feed: document.getElementById('weigher-feed-gate'),
            discharge: document.getElementById('weigher-discharge-gate')
        },
        weigherPanel: document.getElementById('weigher-panel'),
        storagePanel: document.getElementById('storage-panel'),
        sugar: document.getElementById('sugar'),
        weightDisplay: document.getElementById('weight-display'),
        weigherContent: document.getElementById('weigher-content'),
        storageContent: document.getElementById('storage-content'),
        belts: Array.from(document.querySelectorAll('.belt')),
        startBtn: document.getElementById('startBtn'),
        resetBtn: document.getElementById('resetBtn'),
        pos1Btn: document.getElementById('pos1Btn'),
        pos2Btn: document.getElementById('pos2Btn'),
        conveyor5: document.getElementById('conveyor5'),
        storageSlot1: document.getElementById('storage-slot1'),
        storageSlot2: document.getElementById('storage-slot2'),
        allConveyors: Array.from(document.querySelectorAll('.conveyor')),
        alarmPanel: document.getElementById('alarmPanel'),
        alarmResetBtn: document.getElementById('alarmResetBtn'),
        alarmStatus: document.getElementById('alarmStatus'),
        alarmStorageValue: document.getElementById('alarmStorageValue')
    };
    
    // Audio
    const audio = {
        gate: document.getElementById('gateSound'),
        alarm: document.getElementById('alarmSound'),
        conveyor: document.getElementById('conveyorSound')
    };
    
    // Constants
    const cfg = {
        sugarBagWeight: 200,
        maxStorage: 1500,
        shipParkPos: 100,
        craneArmAngle: 180,
        craneHookBottom: 30,
        weigherFillHeight: 80,
        storageFillHeight: 70,
        gateOpenOffset: 10,
        conveyor5Positions: {
            pos1: 990,
            pos2: 1030
        },
        alarmThreshold: 0.95,
        maxStorageLimit: 1500,
        conveyorStartDelay: 3000, // 3 seconds delay between conveyors
        shipGateDelay: 3000 // 3 seconds delay after ship arrival
    };
    
    // State
    let state = {
        running: false,
        currentWeight: 0,
        storageWeight: 0,
        sugarPos: {x: 0, y: 0, visible: false},
        alarmActive: false,
        selectedPosition: 1,
        conveyor5Position: cfg.conveyor5Positions.pos1,
        autoMoveThreshold: 450,
        transportInterval: null,
        warningActive: false,
        systemShutdown: false,
        conveyorSequenceActive: false
    };
    
    // Functions
    const resetAll = () => {
        state.running = false;
        state.currentWeight = 0;
        state.storageWeight = 0;
        state.sugarPos = {x: 0, y: 0, visible: false};
        state.alarmActive = false;
        state.warningActive = false;
        state.selectedPosition = 1;
        state.conveyor5Position = cfg.conveyor5Positions.pos1;
        state.systemShutdown = false;
        state.conveyorSequenceActive = false;
        
        clearInterval(state.transportInterval);
        
        els.ship.style.left = '-300px';
        els.shipGate.style.transform = 'rotate(0deg)';
        els.craneArm.style.transform = 'rotate(210deg)';
        els.craneHook.style.bottom = '-100px';
        els.panels.forEach(p => {
            p.style.backgroundColor = '#000';
            p.textContent = p.id === 'panel5' ? 'MOBILE CONVEYOR' : `CONVEYOR ${p.id.replace('panel','')}`;
            p.classList.remove('system-interlock');
        });
        els.weigherGates.feed.style.top = '-0.5px';
        els.weigherGates.discharge.style.bottom = '-0.5px';
        els.weigherPanel.textContent = 'WEIGHING';
        els.weigherPanel.style.backgroundColor = '#000';
        els.weightDisplay.textContent = '0 kg';
        els.weigherContent.style.height = '0';
        els.storagePanel.textContent = 'STORAGE: 0 Tons';
        els.storagePanel.style.backgroundColor = '#000';
        els.storageContent.style.height = '0';
        els.sugar.style.opacity = '0';
        els.startBtn.disabled = false;

        els.conveyor5.style.left = `${cfg.conveyor5Positions.pos1}px`;
        els.storageSlot1.style.background = 'rgba(255,255,255,0.3)';
        els.storageSlot2.style.background = 'rgba(255,255,255,0.3)';
        
        // Stop all conveyor belts
        els.belts.forEach(b => {
            b.style.animationPlayState = 'paused';
            b.style.opacity = '1';
        });
        
        audio.alarm.pause();
        audio.conveyor.pause();
        
        document.getElementById('storage-warning')?.remove();
        document.getElementById('storage-warning-prelim')?.remove();
        
        els.alarmPanel.classList.remove('active');
        els.alarmStatus.classList.remove('active');
        els.alarmStatus.textContent = 'Storage: Normal';
    };
    
    // NEW FUNCTION: Sequential conveyor startup
    const startConveyorSequence = () => {
        if (state.conveyorSequenceActive) return;
        state.conveyorSequenceActive = true;
        
        console.log("Starting conveyor sequence...");
        
        // Start Mobile Conveyor 5 first
        startConveyor(5, 0);
        
        // Then Conveyor 4 after 3 seconds
        startConveyor(4, cfg.conveyorStartDelay);
        
        // Then Conveyor 3 after 6 seconds
        startConveyor(3, cfg.conveyorStartDelay * 2);
        
        // Then Conveyor 2 after 9 seconds
        startConveyor(2, cfg.conveyorStartDelay * 3);
        
        // Then Conveyor 1 after 12 seconds
        startConveyor(1, cfg.conveyorStartDelay * 4);
    };
    
    // NEW FUNCTION: Start individual conveyor with delay
    const startConveyor = (conveyorNumber, delay) => {
        setTimeout(() => {
            const belt = document.querySelector(`#conveyor${conveyorNumber} .belt`);
            const panel = document.getElementById(`panel${conveyorNumber}`);
            
            if (belt && panel) {
                belt.style.animationPlayState = 'running';
                belt.style.opacity = '1';
                panel.style.backgroundColor = 'green';
                panel.textContent = `CONVEYOR ${conveyorNumber} RUNNING`;
                
                console.log(`Conveyor ${conveyorNumber} started`);
                
                // Start conveyor sound when first conveyor starts
                if (conveyorNumber === 5) {
                    audio.conveyor.currentTime = 0;
                    audio.conveyor.play();
                }
            }
        }, delay);
    };
    
    const updateWeight = (target) => {
        let start = state.currentWeight;
        const duration = 500;
        const startTime = performance.now();
        
        const animate = (time) => {
            const progress = Math.min((time - startTime) / duration, 1);
            state.currentWeight = Math.floor(start + (target - start) * progress);
            els.weightDisplay.textContent = `${state.currentWeight} kg`;
            els.weigherContent.style.height = `${Math.min(state.currentWeight, cfg.weigherFillHeight)}px`;
            if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    };
    
    const updateStorage = (amount) => {
        state.storageWeight += amount;
        els.storagePanel.textContent = `STORAGE: ${state.storageWeight.toLocaleString()} kg`;
        els.storageContent.style.height = `${Math.min(state.storageWeight / (cfg.maxStorage/cfg.storageFillHeight), cfg.storageFillHeight)}px`;
        
        if (state.storageWeight >= cfg.maxStorage * cfg.alarmThreshold && !state.warningActive && state.storageWeight < cfg.maxStorage) {
            triggerWarning();
        }
        
        if (state.storageWeight >= state.autoMoveThreshold && state.storageWeight < cfg.maxStorage) {
            const newPosition = state.selectedPosition === 1 ? 2 : 1;
            moveConveyor5(newPosition);
        }
        
        if (state.storageWeight < cfg.maxStorage && state.alarmActive) {
            resetAlarm();
        }
        
        if (state.storageWeight >= cfg.maxStorage && !state.alarmActive) {
            triggerAlarm();
        }
        
        if (state.storageWeight >= cfg.maxStorageLimit && !state.systemShutdown) {
            triggerMaximumLimitAlarm();
        }
    };
    
    const triggerWarning = () => {
        state.warningActive = true;
        const warning = document.createElement('div');
        warning.textContent = 'WARNING: STORAGE APPROACHING CAPACITY (95%)';
        warning.id = 'storage-warning-prelim';
        warning.style.position = 'absolute';
        warning.style.top = '50px';
        warning.style.left = '80%';
        warning.style.transform = 'translateX(-50%)';
        warning.style.color = 'orange';
        warning.style.fontWeight = 'bold';
        warning.style.fontSize = '20px';
        warning.style.zIndex = '500';
        warning.style.textShadow = '0 0 5px white';
        document.getElementById('scene').appendChild(warning);
        
        setTimeout(() => {
            warning.remove();
            state.warningActive = false;
        }, 5000);
    };
    
    const resetAlarm = () => {
        els.belts.forEach(b => {
            b.style.animationPlayState = 'running';
            b.style.opacity = '1';
        });
        els.panels.forEach(p => p.classList.remove('system-interlock'));
        els.storagePanel.style.backgroundColor = '#000';
        els.startBtn.disabled = false;
        audio.alarm.pause();
        audio.conveyor.play();
        state.alarmActive = false;
        
        document.getElementById('storage-warning').remove();
    };
    
    const triggerAlarm = () => {
        els.belts.forEach(b => {
            b.style.animationPlayState = 'paused';
            b.style.opacity = '0.5';
        });
        
        els.panels.forEach(p => p.classList.add('system-interlock'));
        
        els.storagePanel.style.backgroundColor = 'red';
        els.startBtn.disabled = true;
        audio.alarm.currentTime = 0;
        audio.alarm.play();
        audio.conveyor.pause();
        state.alarmActive = true;
        
        const warning = document.createElement('div');
        warning.textContent = 'MAX STORAGE CAPACITY REACHED (1500TONS)! SYSTEM INTERLOCK ACTIVATED CRANE IN HOLD MODE.';
        warning.id = 'storage-warning';
        warning.style.position = 'absolute';
        warning.style.top = '30px';
        warning.style.left = '50%';
        warning.style.transform = 'translateX(-50%)';
        warning.style.color = 'red';
        warning.style.fontWeight = 'bold';
        warning.style.fontSize = '20px';
        warning.style.zIndex = '500';
        warning.style.textShadow = '0 0 5px white';
        document.getElementById('scene').appendChild(warning);
    };
    
    const triggerMaximumLimitAlarm = () => {
        state.systemShutdown = true;
        state.alarmActive = true;
        
        clearInterval(state.transportInterval);
        stopConveyors();
        
        els.alarmStorageValue.textContent = state.storageWeight;
        els.alarmPanel.classList.add('active');
        els.alarmStatus.classList.add('active');
        els.alarmStatus.textContent = 'ALARM: Storage Full';
        
        audio.alarm.currentTime = 0;
        audio.alarm.play();
        
        els.startBtn.disabled = true;
        
        els.panels.forEach(p => p.classList.add('system-interlock'));
        
        console.log("MAXIMUM STORAGE LIMIT REACHED! SYSTEM SHUTDOWN ACTIVATED.");
    };
    
    const resetMaximumLimitAlarm = () => {
        state.systemShutdown = false;
        state.alarmActive = false;
        
        els.alarmPanel.classList.remove('active');
        els.alarmStatus.classList.remove('active');
        els.alarmStatus.textContent = 'Storage: Normal';
        
        audio.alarm.pause();
        
        els.startBtn.disabled = false;
        
        els.panels.forEach(p => p.classList.remove('system-interlock'));
        
        if (state.running) {
            startConveyors();
            transportSugar();
        }
        
        console.log("MAXIMUM STORAGE LIMIT ALARM RESET. SYSTEM RESUMED.");
    };

    // Reset storage alarm when clicking on storage panel
    const resetStorageAlarm = () => {
        if (state.alarmActive || state.systemShutdown) {
            resetMaximumLimitAlarm();
        }
    };
    
    const moveSugar = (x, y, visible = true) => {
        state.sugarPos = {x, y, visible};
        els.sugar.style.left = `${x}px`;
        els.sugar.style.bottom = `${y}%`;
        els.sugar.style.opacity = visible ? '1' : '0';
    };
    
    const openGate = (gate, isOpen) => {
        if (gate === 'feed') {
            els.weigherGates.feed.style.top = isOpen ? `-${cfg.gateOpenOffset}px` : '-0.5px';
        } else {
            els.weigherGates.discharge.style.bottom = isOpen ? `-${cfg.gateOpenOffset}px` : '-0.5px';
        }
    };
    
    const moveConveyor5 = (position) => {
        state.selectedPosition = position;
        state.conveyor5Position = cfg.conveyor5Positions[`pos${position}`];
        els.conveyor5.style.left = `${state.conveyor5Position}px`;
        
        if (state.alarmActive) {
            resetAlarm();
        }
    };
    
    const dropToStorage = () => {
        if (state.storageWeight >= cfg.maxStorage || state.systemShutdown) {
            return;
        }
         
        const slotElement = state.selectedPosition === 1 ? els.storageSlot1 : els.storageSlot2;
        const slotX = state.selectedPosition === 1 ? 1130 : 1160;
        
        moveSugar(slotX, 23);
        setTimeout(() => {
            slotElement.style.background = 'rgba(255,255,255,0.7)';
            setTimeout(() => {
                slotElement.style.background = 'rgba(255,255,255,0.3)';
                updateStorage(cfg.sugarBagWeight);
                moveSugar(0, 0, false);
            }, 500);
        }, 500);
    };
    
    const startConveyors = () => {
        els.belts.forEach(b => b.style.animationPlayState = 'running');
        audio.conveyor.currentTime = 0;
        audio.conveyor.play();
    };
    
    const stopConveyors = () => {
        els.belts.forEach(b => b.style.animationPlayState = 'paused');
        audio.conveyor.pause();
    };
    
    const transportSugar = () => {
        if (state.storageWeight >= cfg.maxStorage || state.systemShutdown) {
            return;
        }
        
        moveSugar(350, 300);
        
        const steps = [
            () => moveSugar(500, 87),   // Status of Sugar sucked by crane and sugar dropping on Conveyor # 1
            () => moveSugar(650, 83),   //ugar dropping on Conveyor # 2
            () => moveSugar(800, 78),   //ugar dropping on Conveyor # 3
            () => { openGate('feed', true); els.weigherPanel.textContent = 'FEEDING...'; setTimeout(() => moveSugar(850, 0, false), 500) },
            () => { openGate('feed', false); els.weigherPanel.textContent = 'WEIGHING...'; updateWeight(cfg.sugarBagWeight) },
            () => { openGate('discharge', true); els.weigherPanel.textContent = 'DISCHARGING' },
            () => moveSugar(900, 50),
            () => moveSugar(1010, 47),   //Sugar dropping on Conveyor # 4
            () => moveSugar(1115, 40),  //Sugar dropping on Conveyor # 5
            () => { openGate('discharge', false); dropToStorage() },
            () => { els.weigherPanel.textContent = 'COMPLETE'; updateWeight(0) }
        ];
        
        let delay = 0;
        steps.forEach((step, i) => {
            setTimeout(step, delay);
            delay += (i === 2 || i === 3) ? 100 : 500;
        });
        
        if (state.storageWeight < cfg.maxStorage && !state.systemShutdown) {
            state.transportInterval = setTimeout(transportSugar, delay + 500);
        }
    };
    
    const startSequence = () => {
        if (state.running || els.startBtn.disabled || state.systemShutdown) return;
        state.running = true;
        
        document.getElementById('storage-warning')?.remove();
        document.getElementById('storage-warning-prelim')?.remove();
        
        // Start conveyor sequence first
        startConveyorSequence();
        
        // Update panels to show starting status
        els.panels.forEach(p => {
            p.classList.remove('system-interlock');
        });
        
        // Ship arrival
        els.ship.style.left = `${cfg.shipParkPos}px`;
        setTimeout(() => {
            // ADDED: 3-second delay after ship arrival before gate opens
            setTimeout(() => {
                audio.gate.play();
                els.shipGate.style.transform = 'rotate(-70deg)';
                
                // Crane movement
                setTimeout(() => {
                    els.craneArm.style.transform = `rotate(${cfg.craneArmAngle}deg)`;
                    els.craneHook.style.bottom = `${cfg.craneHookBottom}px`;
                    
                    // Start continuous sugar transport after all conveyors are running (12 seconds)
                    setTimeout(transportSugar, cfg.conveyorStartDelay * 3 + 1000);
                }, 2000);
            }, cfg.shipGateDelay); // 3-second delay after ship arrival
        }, 5000);
    };
    
    // Event listeners
    els.startBtn.addEventListener('click', startSequence);
    els.resetBtn.addEventListener('click', resetAll);
    els.pos1Btn.addEventListener('click', () => moveConveyor5(1));
    els.pos2Btn.addEventListener('click', () => moveConveyor5(2));
    els.alarmResetBtn.addEventListener('click', resetMaximumLimitAlarm);
    
    // Event listener for storage panel alarm reset
    els.storagePanel.addEventListener('click', resetStorageAlarm);
    
    // Initialize
    resetAll();
});
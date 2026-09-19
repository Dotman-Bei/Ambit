import os
import json
import subprocess
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

kokoro = Kokoro(
    '/root/.cache/hyperframes/tts/models/kokoro-v1.0.onnx',
    '/root/.cache/hyperframes/tts/voices/voices-v1.0.bin'
)

# Voiceover speed updated to 1.0x as requested
SPEED = 1.0
VOICE = 'am_michael'

shots = {
    'shot1_job.wav': [
        ("Funding an autonomous agent today means handing it a wallet and hoping.", 0.40),
        ("But a balance only answers one question: can this transaction clear?", 0.45),
        ("It cannot tell you if the vendor is trusted, if you already bought this, or who authorized it.", 0.40),
        ("Handing an agent a wallet is giving it a blast radius... not a control.", 0.60)
    ],
    'shot2_wallet.wav': [
        ("Ambit changes the ownership model.", 0.35),
        ("The user owns the wallet throughout, powered by Dynamic delegated access.", 0.40),
        ("Ambit only holds a delegated signing share.", 0.35),
        ("The user can revoke access at any moment.", 0.35),
        ("When revoked, credentials are deleted instantly, and the agent's next request returns 403 Delegation Revoked.", 0.60)
    ],
    'shot3_engine.wav': [
        ("Before any money moves, the proposal enters Ambit's policy engine.", 0.40),
        ("Fifteen deterministic rules evaluate in a fixed, unalterable order.", 0.40),
        ("There is no LLM on the money decision path.", 0.45),
        ("A prompt injection cannot widen what the policy permits, and emergency pause takes effect instantly without deploying code.", 0.60)
    ],
    'shot4_decisions.wav': [
        ("In the live decision stream, the agent proposes a spend.", 0.35),
        ("The engine evaluates every rule.", 0.35),
        ("It grants an ALLOW, minting an approval digest and reserving authority—but no money has moved yet.", 0.45),
        ("If the agent proposes the same call again, it is immediately blocked: DUPLICATE_INTENT.", 0.40),
        ("If it exceeds the cap: PER_CALL_CAP_EXCEEDED.", 0.40),
        ("Zero movement, refused by name.", 0.60)
    ],
    'shot5_settlement.wav': [
        ("Here is the critical seam.", 0.35),
        ("The agent asked for 0.07 USDC.", 0.35),
        ("But at execution, Ambit re-reads the provider's live quote: 0.05 USDC.", 0.45),
        ("The engine re-judges the real price, binds one exact hash, and signs an EIP-3009 authorization using the user's delegated share.", 0.50),
        ("Approve is never called, so no standing allowance exists.", 0.45),
        ("0.05 USDC settles on Base Sepolia with an open transaction hash.", 0.60)
    ],
    'shot6_evidence.wav': [
        ("Anyone can verify this without an account on the public evidence explorer.", 0.45),
        ("Every adversarial test case is published with its real outcome.", 0.40),
        ("Receipts record decision, payment, delivery, and anchor as four separate, honest facts.", 0.45),
        ("No fake claims, and no simulated passes.", 0.60)
    ],
    'shot7_outro.wav': [
        ("Ambit. An authority layer before the money moves.", 0.40),
        ("The agent proposes. The policy decides. Nothing moves until it passes.", 0.45),
        ("Explore Ambit at ambit dot surf.", 0.80)
    ]
}

out_dir = '/root/Ambit/videos/ambit-demo/audio'
os.makedirs(out_dir, exist_ok=True)
sr_native = 24000
target_sr = 48000

manifest = []
current_time = 0.0

print(f"Synthesizing Ambit demo audio at reference cadence (speed={SPEED}, voice={VOICE})...")

for fn, sentences in shots.items():
    parts = []
    full_text = ' '.join([t for t, _ in sentences])
    words = len(full_text.split())
    
    for t, pause_sec in sentences:
        audio, _ = kokoro.create(t, voice=VOICE, speed=SPEED, lang='en-us')
        parts.append(audio)
        silence = np.zeros(int(sr_native * pause_sec), dtype=np.float32)
        parts.append(silence)
        
    combined = np.concatenate(parts)
    raw_path = os.path.join(out_dir, "raw_" + fn)
    sf.write(raw_path, combined, sr_native)
    
    final_path = os.path.join(out_dir, fn)
    resample_cmd = ['ffmpeg', '-y', '-i', raw_path, '-ar', str(target_sr), final_path]
    subprocess.run(resample_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.remove(raw_path)
    
    info = sf.info(final_path)
    duration = round(info.duration, 2)
    start_time = round(current_time, 2)
    end_time = round(current_time + duration, 2)
    wpm = words / (duration / 60)
    
    name = fn.replace('.wav', '')
    print(f"  -> {fn:20}: duration = {duration:5.2f}s | words = {words:2} | WPM = {wpm:5.1f}")
    
    manifest.append({
        'file': final_path,
        'name': name,
        'start': start_time,
        'duration': duration,
        'end': end_time,
        'words': words,
        'text': full_text
    })
    
    current_time += duration

with open('/root/Ambit/videos/ambit-demo/audio_meta.json', 'w') as f:
    json.dump(manifest, f, indent=2)

print(f"\nAll shots synthesized! Total voiceover runtime: {current_time:.2f}s across {len(shots)} shots.")

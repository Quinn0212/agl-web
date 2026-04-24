// ============================================================
// payment.js — Auto-detection for all payment methods
// No "I Have Paid" buttons. Payment confirmed automatically.
//
// Stripe  → confirmCardPayment() returns synchronously ✅
// Alipay  → backend polls Stripe Source every 3s ✅
// TNG     → backend receives TNG Webhook, frontend polls /api/tng-status ✅
// ============================================================

var selectedMethod     = 'tng';
var stripeInstance     = null;
var stripeCard         = null;
var qrInterval         = null;
var alipaySourceId     = null;
var pollInterval       = null;

// ── Helpers ──────────────────────────────────────────────────
function scrollToCourses(){ document.getElementById('courses').scrollIntoView({behavior:'smooth'}); }

function openModal(id){
  document.getElementById(id).classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeModal(id){
  document.getElementById(id).classList.remove('active');
  document.body.style.overflow = '';
  stopPolling();
  clearInterval(qrInterval);
}
document.querySelectorAll('.modal-overlay').forEach(function(o){
  o.addEventListener('click', function(e){ if(e.target === o) closeModal(o.id); });
});

function stopPolling(){
  clearInterval(pollInterval);
  pollInterval = null;
}

// ── Open modal ────────────────────────────────────────────────
function openPayment(){
  document.getElementById('payFormWrap').style.display = 'block';
  document.getElementById('paySuccess').style.display  = 'none';
  selectMethod('tng');
  openModal('paymentModal');
}

// ── Switch method ─────────────────────────────────────────────
function selectMethod(type){
  selectedMethod = type;
  stopPolling();
  clearInterval(qrInterval);

  ['TNG','Alipay','Stripe'].forEach(function(m){
    document.getElementById('btn'+m).classList.remove('selected');
  });
  ['tng','alipay','stripe'].forEach(function(p){
    document.getElementById(p+'Panel').style.display = 'none';
  });

  var map = {tng:'TNG', alipay:'Alipay', stripe:'Stripe'};
  document.getElementById('btn'+map[type]).classList.add('selected');
  document.getElementById(type+'Panel').style.display = 'block';

  if(type === 'tng')    startQRTimer(300, 'qrTimer'); // static QR — no polling needed
  if(type === 'alipay') initAlipay();
  if(type === 'stripe') initStripe();
}

// ── QR countdown ──────────────────────────────────────────────
function startQRTimer(seconds, elId){
  clearInterval(qrInterval);
  var total = seconds || 300;
  function tick(){
    var m = Math.floor(total/60), s = total%60;
    var el = document.getElementById(elId || 'qrTimer');
    if(el) el.textContent = (m<10?'0':'')+m+':'+(s<10?'0':'')+s;
    if(total-- <= 0){ clearInterval(qrInterval); stopPolling(); }
  }
  tick();
  qrInterval = setInterval(tick, 1000);
}

// ════════════════════════════════════════════════════════════
// ALIPAY — Stripe Source, poll /api/payment-status every 3s
// ════════════════════════════════════════════════════════════
function initAlipay(){
  var box = document.getElementById('alipayQRBox');
  box.innerHTML = '<div class="pay-waiting"><div class="pay-waiting-dots"><span></span><span></span><span></span></div><div class="pay-waiting-text">Generating QR code...</div></div>';
  document.getElementById('alipayWaiting').style.display = 'none';

  fetch('/api/alipay-create', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ amount: 800, currency: 'usd' })
  })
  .then(function(r){ return r.json(); })
  .then(function(data){
    if(!data.qr_url){
      box.innerHTML = '<div style="color:var(--red-bright);font-family:var(--font-body);font-size:12px;padding:16px;text-align:center;">Failed to generate QR. Please try another method.</div>';
      return;
    }

    alipaySourceId = data.payment_id;

    box.innerHTML = '<img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data='
      + encodeURIComponent(data.qr_url)
      + '" width="160" height="160" style="background:white;padding:8px;border-radius:4px;" alt="Alipay QR">';

    document.getElementById('alipayWaiting').style.display = 'flex';
    startQRTimer(300, 'alipayTimerEl');

    // Auto-detect payment — no button needed
    pollInterval = setInterval(function(){
      fetch('/api/payment-status?id=' + alipaySourceId)
      .then(function(r){ return r.json(); })
      .then(function(d){
        if(d.status === 'succeeded'){
          stopPolling();
          clearInterval(qrInterval);
          showProcessing(function(){ showSuccess(alipaySourceId); });
        } else if(d.status === 'failed' || d.status === 'canceled'){
          stopPolling();
          clearInterval(qrInterval);
          box.innerHTML = '<div style="color:var(--red-bright);font-family:var(--font-body);font-size:12px;padding:16px;text-align:center;">Payment failed or expired. Please try again.</div>';
          document.getElementById('alipayWaiting').style.display = 'none';
        }
      })
      .catch(function(){});
    }, 3000);

    setTimeout(function(){ stopPolling(); clearInterval(qrInterval); }, 300000);
  })
  .catch(function(){
    box.innerHTML = '<div style="color:var(--red-bright);font-family:var(--font-body);font-size:12px;padding:16px;text-align:center;">Network error. Please try again.</div>';
  });
}

// ════════════════════════════════════════════════════════════
// STRIPE — confirmCardPayment resolves synchronously ✅
// ════════════════════════════════════════════════════════════
function initStripe(){
  if(stripeInstance) return;

  var s = document.createElement('script');
  s.src = 'https://js.stripe.com/v3/';
  s.onload = function(){
    fetch('/api/stripe-key')
    .then(function(r){ return r.json(); })
    .then(function(d){
      stripeInstance = Stripe(d.publishableKey);
      var elements = stripeInstance.elements();
      stripeCard = elements.create('card',{
        style:{
          base:{ color:'#ffffff', fontFamily:'DM Sans, sans-serif', fontSize:'15px', '::placeholder':{color:'#666'} },
          invalid:{ color:'#E74C3C' }
        }
      });
      document.getElementById('stripe-card-element').innerHTML = '';
      stripeCard.mount('#stripe-card-element');
      stripeCard.on('change', function(e){
        document.getElementById('stripe-card-errors').textContent = e.error ? e.error.message : '';
      });
    });
  };
  document.head.appendChild(s);
}

function stripeSubmit(){
  if(!stripeInstance || !stripeCard) return;
  var btn = document.getElementById('stripePayBtn');
  btn.disabled = true;
  btn.textContent = 'Processing\u2026';

  fetch('/api/stripe-create-intent', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ amount: 800, currency: 'usd' })
  })
  .then(function(r){ return r.json(); })
  .then(function(data){
    return stripeInstance.confirmCardPayment(data.clientSecret, {
      payment_method: { card: stripeCard }
    });
  })
  .then(function(result){
    if(result.error){
      document.getElementById('stripe-card-errors').textContent = result.error.message;
      btn.disabled = false;
      btn.textContent = 'PAY $8 NOW';
    } else {
      // Stripe confirmed — auto show success, no user action needed
      showProcessing(function(){ showSuccess(result.paymentIntent.id); });
    }
  })
  .catch(function(err){
    console.error(err);
    btn.disabled = false;
    btn.textContent = 'PAY $8 NOW';
    document.getElementById('stripe-card-errors').textContent = 'Something went wrong. Please try again.';
  });
}

// ── Processing animation ──────────────────────────────────────
function showProcessing(callback){
  var w = document.getElementById('payFormWrap');
  w.innerHTML = '<div style="text-align:center;padding:48px 0;">'
    + '<div class="pay-waiting" style="justify-content:center;">'
    + '<div class="pay-waiting-dots"><span></span><span></span><span></span></div>'
    + '<div class="pay-waiting-text">Confirming payment...</div></div></div>';
  setTimeout(callback, 1800);
}

// ── Final success ─────────────────────────────────────────────
function showSuccess(orderId){
  stopPolling();
  clearInterval(qrInterval);
  document.getElementById('payFormWrap').style.display = 'none';
  document.getElementById('paySuccess').style.display = 'block';
  document.getElementById('orderId').textContent = orderId;
}

// ── Custom cursor ─────────────────────────────────────────────
(function(){
  try{
    if(!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var cur = document.getElementById('cursor'), ring = document.getElementById('cursorRing');
    if(!cur || !ring) return;
    document.documentElement.classList.add('has-custom-cursor');
    document.addEventListener('mousemove', function(e){
      cur.style.left = e.clientX+'px'; cur.style.top = e.clientY+'px';
      setTimeout(function(){ ring.style.left = e.clientX+'px'; ring.style.top = e.clientY+'px'; }, 90);
    });
  }catch(e){}
})();

// ── Scroll reveal ─────────────────────────────────────────────
(function(){
  var obs = new IntersectionObserver(function(entries){
    entries.forEach(function(e,i){
      if(e.isIntersecting) setTimeout(function(){ e.target.classList.add('visible'); }, i*90);
    });
  },{threshold:0.08});
  document.querySelectorAll('.reveal').forEach(function(el){ obs.observe(el); });
})();

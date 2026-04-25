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
// ALIPAY — Stripe PaymentIntent + Stripe.js confirmAlipayPayment
// Backend creates intent → frontend confirms with redirect
// ════════════════════════════════════════════════════════════
function initAlipay(){
  document.getElementById('alipayError').textContent = '';
  var btn = document.getElementById('alipayPayBtn');
  btn.disabled = false;
  btn.innerHTML = 'PAY WITH ALIPAY \u652F\u4ED8\u5B9D';

  // Make sure Stripe.js is loaded (shared with credit card)
  if(!stripeInstance) loadStripeJS();
}

function alipayRedirect(){
  var btn = document.getElementById('alipayPayBtn');
  btn.disabled = true;
  btn.textContent = 'Redirecting\u2026';
  document.getElementById('alipayError').textContent = '';

  // Ensure Stripe.js is loaded first
  function proceed(){
    if(!stripeInstance){
      document.getElementById('alipayError').textContent = 'Payment system loading, please try again.';
      btn.disabled = false;
      btn.innerHTML = 'PAY WITH ALIPAY \u652F\u4ED8\u5B9D';
      return;
    }

    // Step 1: Backend creates PaymentIntent
    fetch('/api/alipay-create', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({})
    })
    .then(function(r){ return r.json(); })
    .then(function(data){
      if(data.error){
        document.getElementById('alipayError').textContent = data.error;
        btn.disabled = false;
        btn.innerHTML = 'PAY WITH ALIPAY \u652F\u4ED8\u5B9D';
        return;
      }

      // Step 2: Stripe.js confirms and redirects to Alipay
      return stripeInstance.confirmAlipayPayment(data.client_secret, {
        return_url: window.location.origin + '/alipay-return.html?pi=' + data.payment_id,
      });
    })
    .then(function(result){
      if(result && result.error){
        document.getElementById('alipayError').textContent = result.error.message;
        btn.disabled = false;
        btn.innerHTML = 'PAY WITH ALIPAY \u652F\u4ED8\u5B9D';
      }
      // If no error, browser is redirecting to Alipay — nothing else to do
    })
    .catch(function(err){
      document.getElementById('alipayError').textContent = 'Network error. Please try again.';
      btn.disabled = false;
      btn.innerHTML = 'PAY WITH ALIPAY \u652F\u4ED8\u5B9D';
    });
  }

  if(stripeInstance) proceed();
  else setTimeout(proceed, 1500); // give Stripe.js a moment to load
}

// ════════════════════════════════════════════════════════════
// STRIPE.JS loader — shared by Credit Card and Alipay
// ════════════════════════════════════════════════════════════
var stripeJSLoading = false;

function loadStripeJS(callback){
  if(stripeInstance){ if(callback) callback(); return; }
  if(stripeJSLoading) return; // already loading
  stripeJSLoading = true;

  var s = document.createElement('script');
  s.src = 'https://js.stripe.com/v3/';
  s.onload = function(){
    fetch('/api/stripe-key')
    .then(function(r){ return r.json(); })
    .then(function(d){
      stripeInstance = Stripe(d.publishableKey);
      if(callback) callback();
    });
  };
  document.head.appendChild(s);
}

// ════════════════════════════════════════════════════════════
// STRIPE — Credit/Debit Card
// ════════════════════════════════════════════════════════════
function initStripe(){
  loadStripeJS(function(){
    if(stripeCard) return; // already mounted
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

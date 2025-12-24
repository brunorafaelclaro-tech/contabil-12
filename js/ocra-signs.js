(function(){
  // Regras de sinal para OCRA export
  // Opção A: defaults por prefixo + overrides por conta
  window.OcraSignRules = {
    defaultsByPrefix: {
      '1': 'asset',
      '2': 'liability',
      '3': 'revenue',
      '4': 'expense',
      '5': 'expense',
      '6': 'expense',
      '7': 'expense',
      '8': 'liability',
      '9': 'liability'
    },
    // Overrides explícitos (fornecer como strings sem formatação)
    overrides: {
      // ativos (asset)
      '1040':'asset','1220':'asset','1230':'asset','1470':'asset','1510':'asset','1565':'asset','1600':'asset','1640':'asset','1689':'asset','1790':'asset','1930':'asset',
      // passivos (liability)
      '2081':'liability','2090':'liability','2440':'liability','2510':'liability','2520':'liability','2700':'liability','2840':'liability','2860':'liability','2902':'liability','2990':'liability',
      // receita
      '3010':'revenue',
      // custo/despesa
      '4040':'expense','4730':'expense','5010':'expense','5900':'expense','6110':'expense','6200':'expense','6300':'expense','6430':'expense','6436':'expense','6500':'expense','6990':'expense','7004':'expense','7110':'expense','7210':'expense','7500':'expense','7615':'expense','7830':'expense','7840':'expense','8300':'liability','8331':'liability','8400':'expense','8436':'expense','8820':'liability','8821':'liability','8910':'expense'
    },
    // Accounts to ignore (do not apply sign changes)
    ignoreAccounts: [ 'AVERAGE_FEE' ],
    // If account starts with any of these prefixes, skip normalization
    ignorePrefixes: [ 'KR_' ]
  };

  window.applyOcraSignRule = function(account, amount) {
    try {
      if (amount === 0 || amount === undefined || amount === null) return amount || 0;
      const acc = String(account || '').trim();
      if (!acc) return amount;
      // ignore special accounts
      for (const p of (window.OcraSignRules.ignorePrefixes || [])) if (acc.startsWith(p)) return amount;
      for (const a of (window.OcraSignRules.ignoreAccounts || [])) if (acc === a) return amount;

      const overrides = window.OcraSignRules.overrides || {};
      const defaults = window.OcraSignRules.defaultsByPrefix || {};

      const override = overrides[acc];
      let nature = override || defaults[String(acc).charAt(0)];
      if (!nature) return amount; // unknown, keep as-is

      // desired sign: asset, expense => positive; liability, revenue => negative
      const desiredPositive = (nature === 'asset' || nature === 'expense');
      const val = Number(amount) || 0;
      if (val === 0) return 0;
      if (desiredPositive && val < 0) return -val;
      if (!desiredPositive && val > 0) return -val;
      return val;
    } catch (e) {
      console.error('applyOcraSignRule error', e, account, amount);
      return amount;
    }
  };

})();

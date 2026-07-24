"use strict";
(globalThis.webpackChunkStaticCmsApp = globalThis.webpackChunkStaticCmsApp || []).push([
  [938],
  {
    99938: (O, t, e) => {
      (e.r(t), e.d(t, { vue: () => R, vueLanguage: () => P }));
      var r = e(72107),
        a = e(6407),
        n = e(59403),
        p = e(7778),
        i = e(54163),
        o = e(64963);
      const l = o.WQ.deserialize({
          version: 14,
          states:
            "%pOVOWOOObQPOOOpOSO'#C_OOOO'#Cp'#CpQVOWOOQxQPOOO!TQQOOQ!YQPOOOOOO,58y,58yO!_OSO,58yOOOO-E6n-E6nO!dQQO'#CqQ{QPOOO!iQPOOQ{QPOOO!qQPOOOOOO1G.e1G.eOOQO,59],59]OOQO-E6o-E6oO!yOpO'#CiO#RO`O'#CiQOQPOOO#ZO#tO'#CmO#fO!bO'#CmOOQO,59T,59TO#qOpO,59TO#vO`O,59TOOOO'#Cr'#CrO#{O#tO,59XOOQO,59X,59XOOOO'#Cs'#CsO$WO!bO,59XOOQO1G.o1G.oOOOO-E6p-E6pOOQO1G.s1G.sOOOO-E6q-E6q",
          stateData:
            "$g~OjOS~OQROUROkQO~OWTOXUOZUO`VO~OSXOTWO~OXUO[]OlZO~OY^O~O[_O~OT`O~OYaO~OmcOodO~OmfOogO~O^iOnhO~O_jOphO~ObkOqkOrmO~OcnOsnOtmO~OnpO~OppO~ObkOqkOrrO~OcnOsnOtrO~OWX`~",
          goto: "!^hPPPiPPPPPPPPPmPPPpPPsy!Q!WTROSRe]Re_QSORYSS[T^Rb[QlfRqlQogRso",
          nodeNames:
            "⚠ Content Text Interpolation InterpolationContent }} Entity Attribute VueAttributeName : Identifier @ Is ScriptAttributeValue AttributeScript AttributeScript AttributeName AttributeValue Entity Entity",
          maxTerm: 36,
          skippedNodes: [0],
          repeatNodeCount: 4,
          tokenData:
            "'y~RdXY!aYZ!a]^!apq!ars!rwx!w}!O!|!O!P#t!Q![#y![!]$s!_!`%g!b!c%l!c!}#y#R#S#y#T#j#y#j#k%q#k#o#y%W;'S#y;'S;:j$m<%lO#y~!fSj~XY!aYZ!a]^!apq!a~!wOm~~!|Oo~!b#RX`!b}!O!|!Q![!|![!]!|!c!}!|#R#S!|#T#o!|%W;'S!|;'S;:j#n<%lO!|!b#qP;=`<%l!|~#yOl~%W$QXY#t`!b}!O!|!Q![#y![!]!|!c!}#y#R#S#y#T#o#y%W;'S#y;'S;:j$m<%lO#y%W$pP;=`<%l#y~$zXX~`!b}!O!|!Q![!|![!]!|!c!}!|#R#S!|#T#o!|%W;'S!|;'S;:j#n<%lO!|~%lO[~~%qOZ~%W%xXY#t`!b}!O&e!Q![#y![!]!|!c!}#y#R#S#y#T#o#y%W;'S#y;'S;:j$m<%lO#y!b&jX`!b}!O!|!Q![!|![!]!|!c!}'V#R#S!|#T#o'V%W;'S!|;'S;:j#n<%lO!|!b'^XW!b`!b}!O!|!Q![!|![!]!|!c!}'V#R#S!|#T#o'V%W;'S!|;'S;:j#n<%lO!|",
          tokenizers: [
            6,
            7,
            new o.RA("b~RP#q#rU~XP#q#r[~aOT~~", 17, 4),
            new o.RA(
              "!k~RQvwX#o#p!_~^TU~Opmq!]m!^;'Sm;'S;=`!X<%lOm~pUOpmq!]m!]!^!S!^;'Sm;'S;=`!X<%lOm~!XOU~~![P;=`<%lm~!bP#o#p!e~!jOk~~",
              72,
              2,
            ),
            new o.RA("[~RPwxU~ZOp~~", 11, 15),
            new o.RA("[~RPrsU~ZOn~~", 11, 14),
            new o.RA(
              "!e~RQvwXwx!_~^Tc~Opmq!]m!^;'Sm;'S;=`!X<%lOm~pUOpmq!]m!]!^!S!^;'Sm;'S;=`!X<%lOm~!XOc~~![P;=`<%lm~!dOt~~",
              66,
              35,
            ),
            new o.RA(
              "!e~RQrsXvw^~^Or~~cTb~Oprq!]r!^;'Sr;'S;=`!^<%lOr~uUOprq!]r!]!^!X!^;'Sr;'S;=`!^<%lOr~!^Ob~~!aP;=`<%lr~",
              66,
              33,
            ),
          ],
          topRules: { Content: [0, 1], Attribute: [1, 7] },
          tokenPrec: 157,
        }),
        u = n.javascriptLanguage.parser.configure({ top: "SingleExpression" }),
        s = l.configure({
          props: [
            (0, p.Gv)({
              Text: p.pJ.content,
              Is: p.pJ.definitionOperator,
              AttributeName: p.pJ.attributeName,
              VueAttributeName: p.pJ.keyword,
              Identifier: p.pJ.variableName,
              "AttributeValue ScriptAttributeValue": p.pJ.attributeValue,
              Entity: p.pJ.character,
              "{{ }}": p.pJ.brace,
              "@ :": p.pJ.punctuation,
            }),
          ],
        }),
        b = { parser: u },
        S = {
          parser: s.configure({
            wrap: (0, i.FE)((O, t) => ("InterpolationContent" == O.name ? b : null)),
          }),
        },
        c = {
          parser: s.configure({
            wrap: (0, i.FE)((O, t) => ("AttributeScript" == O.name ? b : null)),
            top: "Attribute",
          }),
        },
        m = (0, a.html)();
      function Q(O) {
        return O.configure({ dialect: "selfClosing", wrap: (0, i.FE)(g) }, "vue");
      }
      const P = Q(m.language);
      function g(O, t) {
        switch (O.name) {
          case "Attribute":
            return /^(@|:|v-)/.test(t.read(O.from, O.from + 2)) ? c : null;
          case "Text":
            return S;
        }
        return null;
      }
      function R(O = {}) {
        let t = m;
        if (O.base) {
          if ("html" != O.base.language.name || !(O.base.language instanceof r.qp))
            throw new RangeError("The base option must be the result of calling html(...)");
          t = O.base;
        }
        return new r.ri(t.language == m.language ? P : Q(t.language), [
          t.support,
          t.language.data.of({ closeBrackets: { brackets: ["{", '"'] } }),
        ]);
      }
    },
  },
]);

export const TELA9_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Entrega App</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #c8c8c8;
    display: flex;
    justify-content: center;
    min-height: 100vh;
  }
  .phone {
    width: 390px;
    height: 844px;
    background: #eef0f5;
    display: flex;
    flex-direction: column;
  }
  .status-bar { background: #fff; height: 36px; width: 100%; }
  .top-nav {
    background: #fff;
    padding: 11px 16px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .nav-left { display: flex; align-items: center; gap: 12px; }
  .hamburger { display: flex; flex-direction: column; gap: 3.5px; cursor: pointer; }
  .hamburger span { display: block; width: 16px; height: 1.8px; background: #2e3a4e; border-radius: 2px; }
  .brand-pill {
    display: flex;
    align-items: center;
    gap: 7px;
    background: #f0f1f4;
    border-radius: 50px;
    padding: 6px 12px 6px 8px;
  }
  .brand-label { font-size: 15px; font-weight: 500; color: #3d4a5c; }
  .nav-icons { display: flex; align-items: center; gap: 14px; }
  .tab-bar {
    background: #fff;
    display: flex;
    padding: 0 14px;
    border-bottom: 1px solid #e8e8e8;
  }
  .tab {
    flex: 1;
    padding: 12px 0 10px;
    font-size: 15px;
    font-weight: 400;
    color: #888;
    position: relative;
    cursor: pointer;
    white-space: nowrap;
    text-align: center;
  }
  .tab.active { color: #222; font-weight: 500; }
  .tab.active::after {
    content: '';
    position: absolute;
    bottom: -1.5px;
    left: 10%;
    width: 80%;
    height: 2.5px;
    background: #e85d2a;
    border-radius: 2px;
  }
  .date-bar {
    background: #ffffff;
    padding: 16px 16px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #e8e8e8;
  }
  .date-text { font-size: 12px; color: #9ca3af; }
  .date-select { font-size: 12px; color: #4285f4; font-weight: 500; cursor: pointer; }
  .content {
    flex: 1;
    overflow-y: auto;
    margin-top: 12px;
    -webkit-overflow-scrolling: touch;
  }
  .delivery-item {
    background: #fff;
    margin-bottom: 12px;
    border-radius: 18px;
    overflow: hidden;
    margin-left: 4px;
    margin-right: 4px;
  }
  .code-row {
    padding: 14px 16px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 0.5px solid #f0f0f0;
  }
  .code-text { font-size: 12px; color: #8a929e; letter-spacing: 0.2px; }
  .copy-icon { color: #8a929e; cursor: pointer; flex-shrink: 0; }
  .detail-row { padding: 14px 16px 16px; }
  .address-line {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-bottom: 10px;
  }
  .pin-icon { flex-shrink: 0; margin-top: 2px; }
  .address-text {
    font-size: 15px;
    font-weight: 700;
    color: #1a202c;
    line-height: 1.35;
    word-break: keep-all;
    overflow-wrap: normal;
    hyphens: none;
  }
  .recipient {
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 10px;
    word-break: keep-all;
    overflow-wrap: normal;
    hyphens: none;
  }
  .delivery-time {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .check-circle {
    width: 18px;
    height: 18px;
    background: #22c55e;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .time-text { font-size: 12px; color: #22c55e; font-weight: 500; }
  .loading-toast {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    background: rgba(30,30,30,0.85);
    color: #fff;
    width: 136px;
    height: 74px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 500;
    text-align: center;
    z-index: 999;
    transition: opacity 0.4s;
    opacity: 0;
    pointer-events: none;
  }
  .loading-toast.visible { opacity: 1; }
</style>
</head>
<body>
<div class="phone">
  <div class="status-bar"></div>
  <div class="top-nav">
    <div class="nav-left">
      <div class="hamburger"><span></span><span></span><span></span></div>
      <div class="brand-pill">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a5568" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 9h20v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9z"/>
          <path d="M2 9l2-5h16l2 5"/>
          <line x1="12" y1="13" x2="12" y2="19"/>
          <polyline points="9 16 12 13 15 16"/>
        </svg>
        <span class="brand-label">Entrega</span>
      </div>
    </div>
    <div class="nav-icons">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3d4a5c" stroke-width="2.2" stroke-linecap="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3d4a5c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        <circle cx="9" cy="11" r="1" fill="#3d4a5c" stroke="none"/>
        <circle cx="12" cy="11" r="1" fill="#3d4a5c" stroke="none"/>
        <circle cx="15" cy="11" r="1" fill="#3d4a5c" stroke="none"/>
      </svg>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3d4a5c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    </div>
  </div>
  <div class="tab-bar">
    <div class="tab" id="em-rota-label">Em Rota (0)</div>
    <div class="tab">Ocorrência</div>
    <div class="tab active" id="encerrado-label">Encerrado</div>
  </div>
  <div class="date-bar">
    <span class="date-text" id="date-range"></span>
    <span class="date-select">Selecionar data</span>
  </div>
  <div class="content" id="content"></div>
  <div class="loading-toast" id="loadingToast">loading...</div>
</div>
<script>
  (function () {
    var streets = [
      "Rua MarquÃªs de ParanÃ¡",
      "Travessa MarquÃªs de ParanÃ¡",
      "Rua Pastor Manoel Avelino de Souza",
      "Rua Doutor Gustavo Lira",
      "Rua Andrade Pinto",
      "Travessa Fonte",
      "Rua IndÃ­gena",
      "Rua Zita de Carvalho Ferreira",
      "Travessa AraribÃ³ia",
      "Travessa Santo AntÃ´nio",
      "Rua Doutor Genserico Ribeiro",
      "Rua SÃ£o LourenÃ§o",
      "Rua Padre Augusto Lamego",
      "Rua Desiderio de Oliveira",
      "Rua Quatro",
      "Rua Padre Leandro",
      "Rua Princesa Isabel",
      "Avenida Feliciano SodrÃ©",
      "Rua Moreira CÃ©sar (atual Paulo Gustavo)",
      "Rua Miguel de Frias",
      "Rua GaviÃ£o Peixoto",
      "Rua Ator Paulo Gustavo",
      "Rua Tavares de Macedo",
      "Rua Lopes TrovÃ£o",
      "Rua Mariz e Barros",
      "Rua Cinco de Julho",
      "Rua Coronel Moreira CÃ©sar",
      "Rua Mem de SÃ¡",
      "Rua Fagundes Varela",
      "Rua Ãlvares de Azevedo",
      "Rua BelisÃ¡rio Augusto",
      "Rua Domingues de SÃ¡",
      "Rua OtÃ¡vio Carneiro",
      "Rua Presidente Backer",
      "Rua Joaquim TÃ¡vora",
      "Rua Ministro OtÃ¡vio Kelly",
      "Rua Santa Rosa",
      "Rua Noronha TorrezÃ£o",
      "Rua Dr. Sardinha",
      "Rua Desembargador Lima Castro",
      "Rua General Pereira da Silva",
      "Rua Dr. Paulo Alves",
      "Rua Almirante TefÃ©",
      "Rua Visconde do Uruguai",
      "Rua Marechal Deodoro",
      "Rua da ConceiÃ§Ã£o",
      "Rua SÃ£o JoÃ£o",
      "Rua Visconde de Sepetiba",
      "Rua Coronel Gomes Machado",
      "Rua BarÃ£o do Amazonas",
      "Rua Dr. Borman",
      "Rua Benjamin Constant",
      "Alameda SÃ£o Boaventura",
      "Avenida Ernani do Amaral Peixoto",
      "Avenida Visconde do Rio Branco",
      "Avenida Roberto Silveira",
      "Avenida Jornalista Alberto Francisco Torres",
      "Avenida Quintino BocaiÃºva",
      "Avenida Rui Barbosa",
      "Avenida Presidente Roosevelt",
      "Avenida Prefeito SÃ­lvio PicanÃ§o",
      "Avenida Almirante Ary Parreiras",
      "Avenida Almirante TamandarÃ©",
      "Avenida MarquÃªs do ParanÃ¡",
      "Avenida Professor JoÃ£o Brasil",
      "Estrada Francisco da Cruz Nunes",
      "Estrada Caetano Monteiro",
      "Estrada Washington LuÃ­s"
    ];

    var complements = [
      "", "", "", "", "",
      "Apto 301",
      "Apto 408",
      "Apto 1202",
      "Casa 1",
      "Casa 2",
      "Casa 04",
      "Bloco B",
      "Bloco 2",
      "BL B ap 301",
      "Ap 203",
      "Ap 901",
      "Apto 202 bloco D",
      "Interfone 242",
      "Em frente ao mercado",
      "Em frente Ã  farmÃ¡cia",
      "Ligar antes",
      "Casa em frente"
    ];

    var names = [
      "Aline da Silva Brasil",
      "Eduardo Navarro Goudard",
      "Monica Ribeiro de Assis",
      "Camilla Ribeiro",
      "Nathany Tannuri",
      "Juliana Kreischer",
      "Leo Neto",
      "Stephanie Assumpcao Rodrigues",
      "Beatriz Cardoso",
      "Renata Isabel",
      "Carolina Monteiro Leite de Castro",
      "Maian Capella Soares",
      "Leandra Silva",
      "Elaine de Andrade Barros",
      "Edvaldo Jose da Silva",
      "Carlos Eduardo Machado",
      "Audo Ribas Fernandes",
      "Andrea de Jesus Amorim Bessa",
      "Ana Beatriz Marins Mendes",
      "Isabelly Alves Dionizio",
      "Cintia da Silva Areas",
      "Rosemeire Pereira de Paula Moura",
      "Elisangela GonÃ§alves Quintanilha",
      "Isabella Almeida d Acampora",
      "Luan Henrique de Souza",
      "Patricia Nascimento Gomes",
      "Marcos Vinicius Oliveira",
      "Tatiane Cristina Lopes",
      "Vinicius Almeida Pereira",
      "Fernanda Costa Ribeiro",
      "Roberta de Freitas Souza",
      "Paulo Roberto Martins",
      "Amanda Caroline Moreira",
      "Guilherme de Araujo Lima",
      "Luciana Ferreira Santos",
      "Rafael da Conceicao Alves",
      "Priscila Monteiro Campos",
      "Diego Henrique Paixao",
      "Bianca Rodrigues Menezes",
      "Vanessa de Oliveira Castro",
      "Fabio da Rocha Nunes",
      "Larissa Gomes Batista",
      "Mateus Ribeiro Duarte",
      "Natalia de Souza Campos",
      "Thiago Henrique Ribeiro",
      "Bruna da Silva Moreira",
      "Andre Luiz de Freitas",
      "Leticia Andrade Pereira",
      "Joao Victor Cardoso",
      "Mariana Lopes de Carvalho",
      "Cristiane de Paula Mendes",
      "Felipe Augusto Ribeiro",
      "Gabriela Nunes da Costa",
      "Rodrigo de Moura Silva",
      "Suelen Cristina Barbosa",
      "Marcela Pires de Almeida",
      "Danilo Moreira Campos",
      "Tais Cristina Nogueira",
      "Washington Luiz Ferreira",
      "Helena Cardoso Martins",
      "Bruno Henrique da Costa",
      "Sergio Roberto Almeida",
      "Yasmin de Oliveira Nunes",
      "Mirela da Conceicao Rocha",
      "Pedro Lucas Tavares",
      "Kelly Cristina Menezes",
      "Vitor Hugo de Moraes"
    ];

    var letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var usedCodes = new Set();
    var usedAddresses = new Set();
    var content = document.getElementById("content");
    var toast = document.getElementById("loadingToast");
    var dateRange = document.getElementById("date-range");
    var timer = null;
    var now = new Date();

    function pad(value) {
      return String(value).padStart(2, "0");
    }

    function formatDate(date) {
      return pad(date.getDate()) + "-" + pad(date.getMonth() + 1) + "-" + date.getFullYear();
    }

    function formatRangeDate(date) {
      return date.getFullYear() + "/" + pad(date.getMonth() + 1) + "/" + pad(date.getDate());
    }

    function randomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function pickRandom(list) {
      return list[randomInt(0, list.length - 1)];
    }

    function createUniqueCode() {
      var code = "";
      do {
        var prefix = randomInt(100, 999);
        var middle = randomInt(100000, 999999);
        var suffix = randomInt(1000, 9999);
        var letter = letters[randomInt(0, letters.length - 1)];
        code = "BR" + prefix + middle + suffix + letter;
      } while (usedCodes.has(code));
      usedCodes.add(code);
      return code;
    }

    function createUniqueAddress() {
      var address = "";
      do {
        var street = pickRandom(streets);
        var numberBase = randomInt(1, 999);
        var suffixOptions = ["", "A", "B"];
        var number = String(numberBase) + pickRandom(suffixOptions);
        var complement = pickRandom(complements);
        address = complement ? street + ", " + number + ", " + complement : street + ", " + number;
      } while (usedAddresses.has(address));
      usedAddresses.add(address);
      return address;
    }

    function createTimes(dateText, count) {
      var times = [];
      for (var i = 0; i < count; i += 1) {
        var hour = randomInt(8, 20);
        var minute = randomInt(0, 59);
        times.push({
          sort: pad(hour) + ":" + pad(minute),
          text: dateText + " " + pad(hour) + ":" + pad(minute)
        });
      }
      times.sort(function (a, b) {
        return a.sort < b.sort ? 1 : -1;
      });
      return times;
    }

    function escapeHtml(text) {
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function cardHtml(item) {
      return "" +
        "<div class=\\"delivery-item\\">" +
          "<div class=\\"code-row\\">" +
            "<span class=\\"code-text\\">" + escapeHtml(item.code) + "</span>" +
            "<svg class=\\"copy-icon\\" width=\\"14\\" height=\\"14\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"#8a929e\\" stroke-width=\\"2\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\">" +
              "<rect x=\\"9\\" y=\\"9\\" width=\\"13\\" height=\\"13\\" rx=\\"2\\"></rect><path d=\\"M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\\"></path>" +
            "</svg>" +
          "</div>" +
          "<div class=\\"detail-row\\">" +
            "<div class=\\"address-line\\">" +
              "<svg class=\\"pin-icon\\" width=\\"13\\" height=\\"13\\" viewBox=\\"0 0 24 24\\" fill=\\"#4a5568\\" stroke=\\"none\\">" +
                "<path d=\\"M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z\\"></path>" +
              "</svg>" +
              "<span class=\\"address-text\\">" + escapeHtml(item.address) + "</span>" +
            "</div>" +
            "<div class=\\"recipient\\">" + escapeHtml(item.name) + "_</div>" +
            "<div class=\\"delivery-time\\">" +
              "<div class=\\"check-circle\\">" +
                "<svg width=\\"10\\" height=\\"10\\" viewBox=\\"0 0 12 12\\" fill=\\"none\\">" +
                  "<polyline points=\\"2,6 5,9 10,3\\" stroke=\\"#fff\\" stroke-width=\\"2\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\"></polyline>" +
                "</svg>" +
              "</div>" +
              "<span class=\\"time-text\\">Tempo de entrega: " + escapeHtml(item.time) + "</span>" +
            "</div>" +
          "</div>" +
        "</div>";
    }

    function showLoading() {
      toast.classList.add("visible");
      clearTimeout(timer);
      timer = setTimeout(function () {
        toast.classList.remove("visible");
      }, 250);
    }

    function getEncerradoCount() {
      var min = 2860;
      var max = 3562;
      var seed = Number(
        String(now.getFullYear()) +
        String(now.getMonth() + 1).padStart(2, "0") +
        String(now.getDate()).padStart(2, "0")
      );
      var x = Math.sin(seed) * 10000;
      var rnd = x - Math.floor(x);
      return Math.floor(rnd * (max - min + 1)) + min;
    }

    var oldest = new Date(now);
    oldest.setMonth(now.getMonth() - 1);
    dateRange.textContent = formatRangeDate(oldest) + " - " + formatRangeDate(now);

    var encerradoLabel = document.getElementById("encerrado-label");
    if (encerradoLabel) {
      encerradoLabel.textContent = "Encerrado (" + getEncerradoCount() + ")";
    }

    var allTimes = [];
    for (var dayOffset = 0; dayOffset < 5; dayOffset += 1) {
      var day = new Date(now);
      day.setDate(now.getDate() - dayOffset);
      allTimes = allTimes.concat(createTimes(formatDate(day), 100));
    }

    var items = [];
    var lastName = "";
    for (var i = 0; i < 500; i += 1) {
      var name = pickRandom(names);
      while (name === lastName) {
        name = pickRandom(names);
      }
      lastName = name;

      items.push({
        code: createUniqueCode(),
        address: createUniqueAddress(),
        name: name,
        time: allTimes[i].text
      });
    }

    content.innerHTML = items.map(cardHtml).join("");
    setTimeout(showLoading, 200);

    var lastTop = 0;
    content.addEventListener("scroll", function () {
      var currentTop = content.scrollTop;
      if (Math.abs(currentTop - lastTop) > 180) {
        showLoading();
        lastTop = currentTop;
      }
    }, { passive: true });
  })();
</script>
</body>
</html>`;



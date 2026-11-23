# Regras novas do Duelo Elemental

Lista das mudanças pedidas, para ir fazendo uma a uma.
Legenda: ✅ feito · 🎨 precisa de animação nova no PixelLab · 💻 só código

## Combo de socos (3 golpes, o 3º derruba)

| Personagem | 1º golpe | 2º golpe | 3º golpe |
|---|---|---|---|
| Brasa | soco rápido | soco forte | **mordida rápida** 🎨 |
| Geada | soco rápido | soco | chute giratório (igual) |
| Ventokami | soco rápido | soco forte | **estende as duas mãos e repele o adversário com vento** 🎨💻 |
| Faísca | soco rápido | **soco forte com uma bola de raio** 💻 | chute giratório (igual) |

- [x] Brasa: animação da mordida (3º golpe do combo, ataque correndo e enquanto segura)
- [x] Ventokami: animação do empurrão com as duas mãos
- [x] Ventokami: 3º golpe empurra longe com vento, sem derrubar. Efeito: só umas brisas finas (sem tornadinho). Enquanto a animação nova não vem, usa os quadros do soco
- [x] Faísca: 2º golpe usa os quadros do Soco Trovão (bola de raio no punho)

## Ataque correndo (correndo + ataque)

| Personagem | Golpe | Efeito |
|---|---|---|
| Brasa | **morde e agarra por 4 segundos** | causa dano enquanto segura; o oponente não consegue se mexer |
| Geada | **chute avançando com uma bota de gelo** | dano adicional; o oponente fica um pouco mais lento |
| Ventokami | **chute de ar avançando** | não encosta no oponente, só repele |
| Faísca | **soco com as duas mãos** | dá um choque com meio segundo de paralisia |

- [x] Brasa: agarrar 4 s com dano por mordida (código) · animação da mordida ✅
- [x] Geada: bota de gelo com dano extra + lentidão (código + efeito de gelo)
- [x] Ventokami: chute de ar que só repele, sem dano (código + brisas)
- [x] Faísca: choque com 0,5 s de paralisia (código) · animação do soco com as duas mãos ✅

## Investida / movimentação (Shift)

| Personagem | Movimento |
|---|---|
| Brasa | **ombrada pesada** (curta, levanta poeira) |
| Geada | **carrinho deslizando no gelo** (longo, rente ao chão, rastro de gelo) |
| Ventokami | **voadora levada pelo vento** (sobe um pouco e plana, rastro de brisa) |
| Faísca | **bote de gato** (salto em arco, faíscas) |

- [x] Movimento e rastro de cada um (código)
- [x] Ventokami: pose da voadora (perna esticada do chute) · Faísca: pose do bote (corpo esticado do pulo)
- [x] Brasa: animação da ombrada
- [x] Geada: animação do carrinho

## Projétil (cada um diferente)

| Personagem | Projétil | Efeito |
|---|---|---|
| Brasa | Sopro de Fogo: bola de fogo reta | sem defesa: **atordoa + cegueira rápida** (fumaça na cabeça; a CPU cega fica parada) |
| Geada | **rajada de gelo** | **congela** o oponente dentro de uma casca de gelo natural, com pontas |
| Ventokami | Rajada Celestial: meia-lua reta | **cresce enquanto voa** e **leva a pessoa junto** |
| Faísca | Bola de Plasma: bola roxa reta | **empurra**; na defesa vai **diminuindo até sumir**; sem defesa **derruba** |

- [x] Os 4 efeitos (código), testados com e sem defesa
- [x] Gelo do congelado com cara natural (casca com pontas e cristais)
- [x] Geada: animação da rajada de gelo

## Especial (tecla L)

| Personagem | Especial | Efeito |
|---|---|---|
| Brasa | **Investida de Chamas** | avança pegando fogo, **atravessa** o oponente e deixa ele **queimando** por 3 s |
| Geada | **Prisão de Gelo** | **estacas saem do chão** debaixo do oponente (de longe) e congelam |
| Ventokami | Mini Tornado (igual) | o tornado anda, puxa e joga para cima |
| Faísca | **Teleporte Elétrico** | some, reaparece **atrás e em cima, na diagonal**, e desce com o **Soco Trovão** |

- [x] Os 4 (código), testados

## Depois: refazer TODAS as animações de efeitos e poderes
O usuário achou os efeitos atuais (rastros, projéteis, explosões, auras) feios. Refazer com mais capricho,
no estilo da arte dos personagens (o PixelLab tem uma ferramenta grátis de efeitos, a vfx_workbench).

## Gerações a gastar (5 por dia, caem 21h)
1. Brasa: mordida (combo + ataque correndo)
2. Ventokami: empurrão com as duas mãos (combo)
3. Faísca: soco com as duas mãos (ataque correndo)
4. Brasa: ombrada (investida)
5. Geada: carrinho (investida)
6. Geada: rajada de gelo (projétil) → fica para o dia seguinte se as 5 acabarem

## Choque (todo golpe elétrico da Faísca)
- [x] 40% de chance de ELETROCUTAR: paralisado 4 s tomando choque (treme, pisca e aparece o esqueleto/caveirinha). Levar outro golpe solta.

## Próximo: animar os EFEITOS dos poderes (cores de cada elemento)
gelo = azul · fogo = vermelho · ar = rosa · eletricidade = plasma e raios

### Efeitos em pixel art (PixelLab, inspirados nas referências) — assets/fx2
- [x] Rajada de gelo (jato que estica das mãos até o oponente)
- [x] Bloco de cristal do congelado (sem base, meio transparente)
- [x] Bola de fogo bem vermelha
- [x] Meia-lua de vento rosa (cresce)
- [x] Bola de plasma roxa
- [ ] Impactos de cada elemento, estacas da Prisão de Gelo, tornado, choque, queimando, aura de carga

import {
  subPedido,
  subConsultores,
  subDadosCliente,
  subRt,
  subDadosObra,
  subVigencia,
} from '../lib/ficha'
import { resumir } from '../lib/novaDemanda'
import CardCampo from './CardCampo'
import FiPedido from './FiPedido'
import FiConsultores from './FiConsultores'
import FiDadosCliente from './FiDadosCliente'
import FiRt from './FiRt'
import FiDadosObra from './FiDadosObra'
import FiVigencia from './FiVigencia'

// O fieldset desabilita todos os campos do miolo de uma vez (nativo do
// HTML). Ele envolve SO o conteudo — o botao que abre/fecha o card fica
// fora, senao o modo leitura nem deixaria VER a ficha.
// Definido FORA do FichaCards de proposito: componente definido dentro ganha
// identidade nova a cada render e o React REMONTARIA o miolo a cada tecla —
// o campo perderia o foco a cada caractere digitado.
function Miolo({ desabilitado, children }) {
  return (
    <fieldset className="fi-fieldset" disabled={desabilitado}>
      {children}
    </fieldset>
  )
}

// As 8 secoes da ficha de pedido de vendas (§#80), como cards fechados.
// Compartilhadas entre a CRIACAO (FichaFechamento) e o VER/EDITAR
// (FichaDemanda, §F3) — uma implementacao so. Quem guarda o estado e decide
// permissao e o pai; aqui so o desenho.
export default function FichaCards({
  ficha,
  mudar,
  nomeVendedor,
  aberto,
  alternar,
  rtTravada, // edicao: a RT e da demanda e nao muda por aqui (§F3)
  desabilitado, // modo LEITURA (§F3): campos travados, cards ainda ABREM
  sempreAberto, // desktop: as 8 secoes abertas de uma vez (§#83 B3)
}) {
  return (
    <>
      <CardCampo
        id="card-fi-pedido"
        sempreAberto={sempreAberto}
        icone="arquivo"
        titulo="Pedido"
        subtitulo={subPedido(ficha)}
        preenchido={Boolean(
          String(ficha.num_proposta).trim() || String(ficha.valor).trim(),
        )}
        aberto={aberto === 'fi-pedido'}
        aoClicar={() => alternar('fi-pedido')}
      >
        <Miolo desabilitado={desabilitado}>
          <FiPedido ficha={ficha} mudar={mudar} />
        </Miolo>
      </CardCampo>

      <CardCampo
        id="card-fi-consultores"
        sempreAberto={sempreAberto}
        icone="percentual"
        titulo="Consultores e comissão"
        subtitulo={subConsultores(ficha, nomeVendedor)}
        preenchido={String(ficha.comissao_pct).trim() !== ''}
        aberto={aberto === 'fi-consultores'}
        aoClicar={() => alternar('fi-consultores')}
      >
        <Miolo desabilitado={desabilitado}>
          <FiConsultores
            ficha={ficha}
            mudar={mudar}
            nomeVendedor={nomeVendedor}
          />
        </Miolo>
      </CardCampo>

      <CardCampo
        id="card-fi-cliente"
        sempreAberto={sempreAberto}
        icone="perfil"
        titulo="Dados do cliente"
        subtitulo={subDadosCliente(ficha)}
        preenchido={Boolean(
          String(ficha.cliente_cpf).trim() ||
            String(ficha.cliente_telefone1).trim(),
        )}
        aberto={aberto === 'fi-cliente'}
        aoClicar={() => alternar('fi-cliente')}
      >
        <Miolo desabilitado={desabilitado}>
          <FiDadosCliente ficha={ficha} mudar={mudar} />
        </Miolo>
      </CardCampo>

      <CardCampo
        id="card-fi-rt"
        sempreAberto={sempreAberto}
        icone="calculadora"
        titulo="Arquitetura e Engenharia"
        subtitulo={subRt(ficha)}
        preenchido={ficha.rt}
        aberto={aberto === 'fi-rt'}
        aoClicar={() => alternar('fi-rt')}
      >
        <Miolo desabilitado={desabilitado}>
          {/* No modo 100% leitura a dica da RT some (rtTravada=false aqui):
              ela diz "os dados bancarios podem mudar", o que mentiria p/ quem
              nao pode editar nada — os campos ja estao presos pelo fieldset. */}
          <FiRt
            ficha={ficha}
            mudar={mudar}
            rtTravada={rtTravada && !desabilitado}
          />
        </Miolo>
      </CardCampo>

      <CardCampo
        id="card-fi-obra"
        sempreAberto={sempreAberto}
        icone="origem"
        titulo="Dados da obra"
        subtitulo={subDadosObra(ficha)}
        preenchido={Boolean(String(ficha.mestre_obra).trim())}
        aberto={aberto === 'fi-obra'}
        aoClicar={() => alternar('fi-obra')}
      >
        <Miolo desabilitado={desabilitado}>
          <FiDadosObra ficha={ficha} mudar={mudar} />
        </Miolo>
      </CardCampo>

      <CardCampo
        id="card-fi-medicao"
        sempreAberto={sempreAberto}
        icone="lista"
        titulo="Medição p/ contramarco"
        subtitulo={
          String(ficha.medicao_contramarco).trim()
            ? resumir(ficha.medicao_contramarco)
            : 'Condições e observações'
        }
        preenchido={Boolean(String(ficha.medicao_contramarco).trim())}
        aberto={aberto === 'fi-medicao'}
        aoClicar={() => alternar('fi-medicao')}
      >
        <Miolo desabilitado={desabilitado}>
          <textarea
            value={ficha.medicao_contramarco}
            onChange={(e) => mudar('medicao_contramarco', e.target.value)}
            rows={4}
            aria-label="Condição de medição para contramarco"
          />
        </Miolo>
      </CardCampo>

      <CardCampo
        id="card-fi-particularidades"
        sempreAberto={sempreAberto}
        icone="aviso"
        titulo="Particularidades da obra"
        subtitulo={
          String(ficha.fiscal_obra).trim() ||
          String(ficha.particularidades).trim()
            ? [
                String(ficha.fiscal_obra).trim(),
                resumir(ficha.particularidades, 24),
              ]
                .filter(Boolean)
                .join(' · ')
            : 'Fiscal de obra e atenção especial'
        }
        preenchido={Boolean(
          String(ficha.fiscal_obra).trim() ||
            String(ficha.particularidades).trim(),
        )}
        aberto={aberto === 'fi-particularidades'}
        aoClicar={() => alternar('fi-particularidades')}
      >
        <Miolo desabilitado={desabilitado}>
        <label className="campo-linha">
          <span className="campo-rot">Fiscal de obra</span>
          <input
            type="text"
            value={ficha.fiscal_obra}
            onChange={(e) => mudar('fiscal_obra', e.target.value)}
          />
        </label>
        <label className="campo-linha">
          <span className="campo-rot">
            O que necessita de atenção especial
          </span>
          <textarea
            value={ficha.particularidades}
            onChange={(e) => mudar('particularidades', e.target.value)}
            rows={4}
          />
        </label>
        </Miolo>
      </CardCampo>

      <CardCampo
        id="card-fi-vigencia"
        sempreAberto={sempreAberto}
        icone="relogio"
        titulo="Vigência do contrato"
        subtitulo={subVigencia(ficha)}
        preenchido={subVigencia(ficha).includes('preenchido')}
        aberto={aberto === 'fi-vigencia'}
        aoClicar={() => alternar('fi-vigencia')}
      >
        <Miolo desabilitado={desabilitado}>
          <FiVigencia ficha={ficha} mudar={mudar} />
        </Miolo>
      </CardCampo>
    </>
  )
}
